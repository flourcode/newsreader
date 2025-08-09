// ==========================================
// RSS AGGREGATOR LAMBDA FUNCTION
// 
// A serverless RSS feed aggregator for AWS Lambda
// Runtime: Node.js 18.x or 20.x
// ==========================================

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// AWS Configuration - MODIFY THESE
const s3Client = new S3Client({ region: 'YOUR_AWS_REGION' }); // e.g., 'us-east-1'
const BUCKET_NAME = 'YOUR_S3_BUCKET_NAME'; // Your S3 bucket for storing data
const RSS2JSON_API_KEY = 'YOUR_RSS2JSON_API_KEY'; // Get from rss2json.com

// RSS Feed Configuration - MODIFY THIS LIST
const RSS_FEEDS = [
    // Example feeds - replace with your own
    { 
        name: 'TechCrunch', 
        url: 'https://techcrunch.com/feed/', 
        category: 'tech' 
    },
    { 
        name: 'Hacker News', 
        url: 'https://hnrss.org/frontpage', 
        category: 'tech' 
    },
    { 
        name: 'BBC News', 
        url: 'http://feeds.bbci.co.uk/news/rss.xml', 
        category: 'news' 
    },
    { 
        name: 'The Verge', 
        url: 'https://www.theverge.com/rss/index.xml', 
        category: 'tech' 
    },
    { 
        name: 'Reuters Business', 
        url: 'https://feeds.reuters.com/reuters/businessNews', 
        category: 'business' 
    },
    // Add more feeds here following the same pattern
];

/**
 * Utility Functions
 */

// Clean HTML and special characters from text
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Smart text truncation
function smartTruncate(text, maxLength = 200) {
    if (!text || text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('. ');
    const lastQuestion = truncated.lastIndexOf('? ');
    const lastExclamation = truncated.lastIndexOf('! ');
    
    const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastBoundary > maxLength * 0.6) {
        return text.substring(0, lastBoundary + 2);
    }
    
    const lastSpace = truncated.lastIndexOf(' ');
    return text.substring(0, lastSpace) + '...';
}

// Estimate reading time
function estimateReadingTime(text) {
    if (!text) return 1;
    const words = text.split(/\s+/).length;
    const minutes = Math.ceil(words / 200); // Average reading speed
    return Math.min(minutes, 10); // Cap at 10 minutes
}

// Get article characteristics/tags
function getArticleCharacteristics(title, description) {
    const characteristics = [];
    
    // Check for data/numbers
    if (/\d{2,}/.test(title) || /%/.test(title)) {
        characteristics.push('data');
    }
    
    // Check for breaking news
    const breakingKeywords = /breaking|urgent|alert|immediate|just in|now|update/i;
    if (breakingKeywords.test(title)) {
        characteristics.push('breaking');
    }
    
    // Check for long reads
    if (description && description.length > 300) {
        characteristics.push('longread');
    }
    
    // Check for tech content
    const techKeywords = /AI|tech|software|startup|programming|code|api|app/i;
    if (techKeywords.test(title + ' ' + description)) {
        characteristics.push('tech');
    }
    
    return characteristics;
}

/**
 * RSS Feed Processing
 */

// Fetch single RSS feed with retry logic
const fetchFeed = async (feed, retryCount = 0) => {
    try {
        const cleanUrl = feed.url.trim().replace(/['`]/g, '');
        console.log(`Fetching ${feed.name} (${feed.category})`);
        
        // Using RSS2JSON service to convert RSS to JSON
        const response = await fetch(
            `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(cleanUrl)}&api_key=${RSS2JSON_API_KEY}&count=20`,
            {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(15000) // 15 second timeout
            }
        );
        
        if (!response.ok) {
            // Retry on rate limits
            if (response.status === 429 && retryCount < 2) {
                const delayTime = Math.pow(2, retryCount) * 2000;
                console.log(`Rate limited ${feed.name}, retrying in ${delayTime/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delayTime));
                return fetchFeed(feed, retryCount + 1);
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.status !== 'ok') {
            throw new Error(`API Error: ${data.message || 'Unknown error'}`);
        }
        
        // Process and clean the articles
        const items = data.items.map(item => {
            const cleanedTitle = cleanText(item.title);
            const cleanedDescription = cleanText(item.description);
            
            return {
                title: cleanedTitle,
                link: item.link,
                description: smartTruncate(cleanedDescription, 200),
                fullDescription: cleanedDescription,
                pubDate: item.pubDate,
                source: feed.name,
                category: feed.category,
                readingTime: estimateReadingTime(cleanedDescription),
                characteristics: getArticleCharacteristics(cleanedTitle, cleanedDescription),
                contentLength: cleanedDescription.length
            };
        });
        
        console.log(`✓ ${feed.name}: ${items.length} items`);
        return items;
        
    } catch (error) {
        console.error(`✗ ${feed.name}: ${error.message}`);
        return []; // Return empty array on error
    }
};

/**
 * Data Analysis
 */

// Calculate feed statistics
function calculateStatistics(articles) {
    const categoryCounts = articles.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
    }, {});
    
    // Find trending topics
    const wordFrequency = {};
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 
        'for', 'of', 'with', 'by', 'as', 'is', 'was', 'are', 'were',
        'this', 'that', 'will', 'be', 'has', 'have', 'can', 'could'
    ]);
    
    articles.forEach(item => {
        const words = (item.title + ' ' + item.description).toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.has(word));
        
        words.forEach(word => {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        });
    });
    
    const trendingTopics = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
    
    return {
        categoryCounts,
        trendingTopics,
        freshContent: articles.filter(item => {
            const hours = (Date.now() - new Date(item.pubDate)) / 3600000;
            return hours < 2;
        }).length
    };
}

/**
 * Storage Functions
 */

// Save aggregated data to S3
async function saveToS3(data, key = 'rss-data.json') {
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: JSON.stringify(data, null, 2),
            ContentType: 'application/json',
            CacheControl: 'public, max-age=300' // 5 minute cache
        }));
        console.log(`✓ Saved data to S3: ${key}`);
    } catch (error) {
        console.error('Error saving to S3:', error);
        throw error;
    }
}

// Load existing data from S3
async function loadFromS3(key = 'rss-data.json') {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        const response = await s3Client.send(command);
        const data = await response.Body.transformToString();
        return JSON.parse(data);
    } catch (error) {
        console.log(`No existing data found: ${error.message}`);
        return null;
    }
}

/**
 * Main Lambda Handler
 */
export const handler = async (event) => {
    try {
        console.log('Starting RSS aggregation...');
        const startTime = Date.now();
        
        // Handle CORS preflight requests
        if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400'
                },
                body: ''
            };
        }
        
        // Fetch all RSS feeds concurrently with rate limiting
        const results = [];
        for (const feed of RSS_FEEDS) {
            const result = await fetchFeed(feed);
            results.push(result);
            // Small delay to be nice to RSS services
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Combine and deduplicate articles
        const seenLinks = new Set();
        const allArticles = [];
        
        for (const articles of results) {
            for (const article of articles) {
                if (!seenLinks.has(article.link)) {
                    seenLinks.add(article.link);
                    allArticles.push(article);
                }
            }
        }
        
        // Sort by publication date (newest first)
        allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // Calculate statistics
        const stats = calculateStatistics(allArticles);
        
        // Prepare final data structure
        const aggregatedData = {
            items: allArticles,
            summary: {
                total: allArticles.length,
                timestamp: new Date().toISOString(),
                fetchDuration: Date.now() - startTime,
                sources: RSS_FEEDS.map(feed => ({
                    name: feed.name,
                    category: feed.category,
                    count: allArticles.filter(item => item.source === feed.name).length
                })),
                ...stats
            }
        };
        
        // Save to S3
        await saveToS3(aggregatedData);
        
        console.log(`✓ Successfully processed ${allArticles.length} articles from ${RSS_FEEDS.length} sources`);
        console.log(`✓ Fresh content: ${stats.freshContent} articles`);
        console.log(`✓ Processing time: ${aggregatedData.summary.fetchDuration}ms`);
        
        // Return success response
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: true,
                count: allArticles.length,
                categories: stats.categoryCounts,
                sources: aggregatedData.summary.sources,
                freshContent: stats.freshContent,
                fetchDuration: aggregatedData.summary.fetchDuration,
                timestamp: aggregatedData.summary.timestamp
            })
        };
        
    } catch (error) {
        console.error('Handler error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

/**
 * Optional: Scheduled execution handler
 * Use this if you want to run the aggregator on a schedule
 */
export const scheduledHandler = async (event) => {
    console.log('Scheduled RSS aggregation triggered');
    return await handler(event);
};

/**
 * Configuration Examples:
 * 
 * 1. Environment Variables to set in Lambda:
 *    - AWS_REGION: Your AWS region
 *    - S3_BUCKET: Your S3 bucket name
 *    - RSS2JSON_API_KEY: Your RSS2JSON API key
 * 
 * 2. IAM Permissions needed:
 *    - s3:PutObject on your bucket
 *    - s3:GetObject on your bucket
 *    - logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents
 * 
 * 3. Lambda Configuration:
 *    - Runtime: Node.js 18.x or 20.x
 *    - Timeout: 5 minutes
 *    - Memory: 512 MB
 * 
 * 4. Trigger Options:
 *    - EventBridge (CloudWatch Events) for scheduled execution
 *    - Lambda Function URL for HTTP access
 *    - API Gateway for REST API
 */