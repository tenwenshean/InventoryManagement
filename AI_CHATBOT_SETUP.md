# AI Chatbot Feature - Setup Guide

## Overview
An AI-powered chatbot has been added to the Reports page that can analyze inventory management and financial data using OpenAI's GPT API.

## Features

### 1. **Intelligent Data Analysis**
- Analyzes real-time inventory, sales, and financial data
- Provides insights on trends, patterns, and anomalies
- Offers actionable recommendations

### 2. **Contextual Understanding**
- Accesses complete reports data including:
  - Key metrics (revenue, units sold, order value, return rate)
  - Monthly sales and inventory trends
  - Accounting and cash flow data
  - AI predictions
  - Top products and category distribution

### 3. **Interactive Chat Interface**
- Beautiful gradient UI with Brain icon
- Conversation history
- Suggested questions for quick start
- Real-time AI responses
- Typing indicators

## Setup Instructions

### 1. **Environment Variables**

You need to add your OpenAI API key to your environment variables:

#### For Local Development:
Create or update `.env` file in the project root:
```env
OPENAI_API_KEY=sk-your-api-key-here
```

#### For Vercel Production:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add new variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-`)
   - **Environment**: Production, Preview, Development

### 2. **Get OpenAI API Key**

1. Go to https://platform.openai.com/api-keys
2. Create an account or sign in
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)
5. Add it to your environment variables

### 3. **API Model**

The chatbot uses **GPT-4o-mini** model which is:
- Cost-effective ($0.150 per 1M input tokens, $0.600 per 1M output tokens)
- Fast and efficient
- Great for business analysis tasks

You can change the model in `api/index.js` in the `handleReportsChat` function:
```javascript
model: 'gpt-4o-mini', // Change to 'gpt-4' for more advanced reasoning
```

## Usage

### 1. **Access the Chatbot**
- Navigate to the Reports page (`/reports`)
- Click the floating purple Brain icon in the bottom-right corner
- The chatbot panel will slide in

### 2. **Ask Questions**

Example questions:
- "What are my top performing products?"
- "How is my cash flow looking?"
- "What financial trends should I be aware of?"
- "Are there any concerning inventory issues?"
- "What do the AI predictions suggest?"
- "Analyze my profit margins"
- "Which products should I restock?"
- "What's my revenue growth trend?"

### 3. **Understanding Responses**

The AI will:
- Reference specific data points from your reports
- Provide numerical analysis
- Highlight trends (increasing/decreasing)
- Offer actionable recommendations
- Point out anomalies or concerns
- Use markdown formatting for clarity

## Technical Implementation

### Files Modified/Created:

1. **`client/src/components/reports-chatbot.tsx`** (NEW)
   - React component for the chat interface
   - Handles message state and API communication
   - Beautiful UI with gradient styling

2. **`client/src/pages/reports.tsx`** (MODIFIED)
   - Added chatbot integration
   - Floating button to open chat
   - Passes reports data to chatbot

3. **`api/index.js`** (MODIFIED)
   - Added `/api/reports/chat` endpoint
   - Integrated OpenAI API
   - Handles GPT conversation with context

4. **`package.json`** (MODIFIED)
   - Added `openai` package dependency

### API Endpoint

**POST** `/api/reports/chat`

**Headers:**
```
Authorization: Bearer <firebase-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "What are my top products?",
  "reportsData": { /* full reports data object */ },
  "conversationHistory": [
    { "role": "user", "content": "previous message" },
    { "role": "assistant", "content": "previous response" }
  ]
}
```

**Response:**
```json
{
  "response": "Based on your data, here are your top products...",
  "usage": {
    "prompt_tokens": 1234,
    "completion_tokens": 567,
    "total_tokens": 1801
  }
}
```

## Cost Estimation

With GPT-4o-mini model:
- ~1,000 tokens per chat interaction (data context + conversation)
- ~500 tokens per response
- **Cost per chat**: ~$0.0003 (0.03 cents)
- **100 chats**: ~$0.03
- **1,000 chats**: ~$0.30

Very affordable for business insights!

## Security

- ✅ Protected route (requires authentication)
- ✅ User-specific data only
- ✅ API key stored securely in environment variables
- ✅ No data stored by OpenAI (per API usage policy)
- ✅ Conversation history kept client-side only

## Troubleshooting

### "AI service not configured"
- Check that `OPENAI_API_KEY` is set in environment variables
- Restart the development server after adding the key
- Verify the key starts with `sk-`

### "AI service quota exceeded"
- Check your OpenAI account billing and usage limits
- Upgrade your OpenAI plan if needed
- Wait for quota to reset (usually monthly)

### Slow responses
- Normal for first request (cold start)
- GPT-4o-mini is very fast (1-3 seconds typically)
- Consider upgrading to GPT-4 for better reasoning (but slower and more expensive)

### Empty or generic responses
- Ensure reports data is being passed correctly
- Check browser console for errors
- Verify user has data in their account

## Future Enhancements

Potential improvements:
- Save conversation history to database
- Add voice input/output
- Export chat conversations
- More specialized prompts for different types of analysis
- Integration with other pages (inventory, accounting, etc.)
- Custom AI instructions per user
- Multi-language support

## Support

For issues or questions:
1. Check browser console for errors
2. Check server logs for API errors
3. Verify environment variables are set correctly
4. Test with a simple question first
5. Check OpenAI API status: https://status.openai.com/

---

**Note**: Remember to never commit your `.env` file with actual API keys to version control. The `.env.example` file should contain placeholder values only.
