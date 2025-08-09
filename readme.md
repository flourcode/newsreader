# RSS Reader - Personal News Dashboard

A modern, responsive RSS feed aggregator with a clean interface and serverless backend. Perfect for creating your own curated news dashboard.

## 🚀 Features

- **Clean, Modern Interface**: Responsive design that works on desktop and mobile
- **Real-time Updates**: Automatic refresh and manual refresh options
- **Category Filtering**: Organize feeds by categories (tech, business, news, etc.)
- **Dark Mode**: Eye-friendly dark theme
- **Fresh Content Indicators**: Highlights recent articles
- **Serverless Backend**: AWS Lambda-powered RSS aggregation
- **Fast Loading**: Optimized for performance

## 📋 Prerequisites

- AWS Account (for backend)
- RSS2JSON API key (free tier available)
- Basic knowledge of AWS Lambda and S3

## 🛠️ Setup Instructions

### Backend Setup (AWS Lambda)

1. **Create an S3 Bucket**
   ```bash
   # Using AWS CLI
   aws s3 mb s3://your-rss-bucket-name
   ```

2. **Get RSS2JSON API Key**
   - Visit [RSS2JSON.com](https://rss2json.com/)
   - Sign up for a free account
   - Get your API key from the dashboard

3. **Deploy Lambda Function**
   - Copy the `rss-lambda-backend.js` code
   - Create a new Lambda function in AWS Console
   - Set runtime to Node.js 18.x or 20.x
   - Set timeout to 5 minutes
   - Set memory to 512 MB

4. **Configure Environment Variables**
   ```
   AWS_REGION=us-east-1
   S3_BUCKET=your-rss-bucket-name
   RSS2JSON_API_KEY=your_api_key_here
   ```

5. **Set IAM Permissions**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject"
         ],
         "Resource": "arn:aws:s3:::your-rss-bucket-name/*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "logs:CreateLogGroup",
           "logs:CreateLogStream",
           "logs:PutLogEvents"
         ],
         "Resource": "arn:aws:logs:*:*:*"
       }
     ]
   }
   ```

6. **Create Function URL**
   - In Lambda console, go to Configuration → Function URL
   - Create function URL with CORS enabled
   - Note the URL for frontend configuration

7. **Set up Scheduled Execution (Optional)**
   - Go to Configuration → Triggers
   - Add EventBridge trigger
   - Set schedule expression: `rate(15 minutes)`

### Frontend Setup

1. **Configure API Endpoint**
   - Open `index.html`
   - Replace `YOUR_API_ENDPOINT_HERE` with your Lambda Function URL
   - Example:
   ```javascript
   const RSS_API_ENDPOINT = 'https://your-lambda-url.lambda-url.us-east-1.on.aws/';
   ```

2. **Customize RSS Feeds**
   - Edit the `RSS_FEEDS` array in the Lambda function
   - Add your preferred RSS feeds:
   ```javascript
   const RSS_FEEDS = [
     { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech' },
     { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', category: 'news' },
     // Add more feeds...
   ];
   ```

3. **Deploy Frontend**
   - Host the HTML file on any web server
   - Options include:
     - GitHub Pages
     - Netlify
     - Vercel
     - AWS S3 Static Website
     - Your own web server

## 🎨 Customization

### Adding New RSS Feeds

1. **Find RSS URLs**: Look for RSS/feed links on websites
2. **Add to Lambda**: Edit the `RSS_FEEDS` array in your Lambda function
3. **Set Categories**: Assign appropriate categories for filtering

Example feeds to try:
```javascript
// News
{ name: 'Reuters', url: 'https://feeds.reuters.com/Reuters/worldNews', category: 'news' },
{ name: 'Associated Press', url: 'https://feeds.apnews.com/rss/apf-topnews', category: 'news' },

// Technology
{ name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech' },
{ name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'tech' },

// Business
{ name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'business' },
{ name: 'Financial Times', url: 'https://www.ft.com/rss/home', category: 'business' },
```

### Styling Customization

The frontend uses CSS custom properties for easy theming:

```css
:root {
  --bg-primary: #f8f9fa;
  --text-primary: #24292f;
  --accent-primary: #0969da;
  /* Modify these colors to match your brand */
}
```

### Adding New Categories

1. **Backend**: Add new category values in RSS_FEEDS
2. **Frontend**: Add CSS classes for category colors:
```css
.article-source.yourcategory { color: #your-color; }
```

## 📱 Features Explained

### Dark Mode
- Automatically saves preference to localStorage
- Smooth transitions between themes
- Optimized colors for readability

### Fresh Content Detection
- Articles less than 2 hours old are marked as "fresh"
- Fresh count badges on category filters
- Visual indicators on article cards

### Auto Refresh
- Automatically refreshes every 15 minutes when page is visible
- Manual refresh button available
- Smart refresh on tab focus after extended absence

### Mobile Optimization
- Responsive grid layout
- Touch-friendly interface
- Optimized typography for mobile reading

## 🔧 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure Lambda Function URL has CORS enabled
   - Check that the OPTIONS handler is working

2. **No Articles Loading**
   - Verify RSS2JSON API key is correct
   - Check Lambda logs for errors
   - Ensure S3 bucket permissions are correct

3. **Feeds Not Updating**
   - Check if RSS URLs are still valid
   - Verify Lambda is running on schedule
   - Look for rate limiting from RSS2JSON

### Debugging

1. **Check Lambda Logs**
   ```bash
   aws logs tail /aws/lambda/your-function-name --follow
   ```

2. **Test Lambda Function**
   - Use Lambda console test feature
   - Check response format matches frontend expectations

3. **Verify S3 Storage**
   ```bash
   aws s3 ls s3://your-rss-bucket-name/
   ```

## 💰 Cost Estimation

**AWS Costs (monthly, approximate):**
- Lambda: $0.00 - $0.20 (depending on usage)
- S3: $0.00 - $0.10 (minimal storage)
- Data Transfer: $0.00 - $0.05

**RSS2JSON API:**
- Free: 10,000 requests/month
- Pro: $5/month for 100,000 requests

Total estimated cost: **$0-5/month** for personal use

## 🚀 Deployment Options

### Option 1: AWS Complete Stack
- Lambda + S3 + CloudFront
- Most scalable and professional

### Option 2: Hybrid Approach
- Lambda for RSS processing
- GitHub Pages for frontend hosting
- Good balance of simplicity and functionality

### Option 3: Serverless Alternative
- Use Netlify Functions instead of Lambda
- Deploy everything on Netlify
- Simpler deployment process

## 📚 Advanced Features to Add

- **Search functionality** across articles
- **Bookmarking system** for saving articles
- **Email digest** of daily/weekly summaries
- **Social sharing** improvements
- **Analytics** for reading habits
- **Full-text search** within articles
- **AI-powered** article summarization

## 🤝 Contributing

Feel free to fork this project and submit pull requests for:
- Bug fixes
- New features
- UI improvements
- Documentation updates

## 📄 License

MIT License - feel free to use this for personal or commercial projects.

## 🙋‍♂️ Support

If you run into issues:
1. Check the troubleshooting section above
2. Review AWS Lambda and S3 documentation
3. Open an issue in the GitHub repository
4. Check RSS2JSON documentation for API limits

---

**Happy RSS reading! 📰**
