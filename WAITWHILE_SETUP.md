# Waitwhile API Integration Setup Guide

## ✅ **INTEGRATION COMPLETE**

All service IDs have been successfully integrated! The Waitwhile API integration is now **100% functional**.

### **Integration Status:**
- [x] **Customer Creation**: Fully implemented and tested
- [x] **Visit Creation**: Fully implemented and tested  
- [x] **Location Mapping**: All 7 locations configured with Waitwhile location IDs
- [x] **Service Mapping**: ✅ **COMPLETE** - All service IDs integrated with intelligent selection logic
- [x] **Error Handling**: Comprehensive error handling and user feedback
- [x] **TypeScript Types**: Complete type safety across all components
- [x] **Phone Validation**: Fixed and working for US domestic numbers
- [x] **Form Validation**: Complete validation before API submission

---

## 🎯 Service ID Configuration

### **How Service Selection Works**

The system intelligently determines the correct Waitwhile service ID based on the user's journey through the form:

#### **Members (Priority Pass/Lounge Key Users)**
- **With $29 Spinal Adjustment**: `DoCvBDfuyv3HjlCra5Jc`
- **Without $29 Spinal Adjustment**: `mZChb5bacT7AeVU7E3Rz`

#### **Non-Members (Treatment Selection)**
- **Body on the Go**: `IhqDpECD89j2e7pmHCEW`
- **Total Wellness**: `11AxkuHmsd0tClHLitZ7`  
- **Sciatica & Lower Back Targeted Therapy**: `QhSWYhwLpnoEFHJZkGQf`
- **Neck & Upper Back Targeted Therapy**: `59q5NJG9miDfAgdtn8nK`
- **Trigger Point Muscle Therapy & Stretch**: `hD5KfCW1maA1Vx0za0fv`
- **Chiro Massage**: `ts1phHc92ktj04d0Gpve`
- **Chiro Massage Mini**: `J8qHXtrsRC2aNPA04YDc`
- **Undecided**: `FtfCqXMwnkqdft5aL0ZX`

### **Service Selection Logic**

The `getServiceId()` function in `src/utils/locationData.ts` determines the correct service based on:

1. **Membership Status**: Whether user has Priority Pass/Lounge Key
2. **Member Path**: Whether they want the $29 spinal adjustment add-on  
3. **Non-Member Path**: Which specific treatment they select from the menu

---

This guide walks you through setting up the Waitwhile API integration for the Chiroport application.

## Prerequisites

1. **Waitwhile Account**: You need a Waitwhile business account with API access
2. **API Key**: Obtain your API key from Waitwhile dashboard
3. **Location IDs**: Get the location IDs for each airport concourse from Waitwhile

## Step 1: Environment Configuration

1. Copy the environment template:
   ```bash
   cp env.template .env.local
   ```

2. Fill in your Waitwhile credentials in `.env.local`:
   ```env
   # Waitwhile API Configuration
   WAITWHILE_API_KEY=your_actual_api_key_here
   WAITWHILE_API_URL=https://api.waitwhile.com/v2
   WAITWHILE_WEBHOOK_SECRET=your_webhook_secret_here
   
   # Application Configuration
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

## Step 2: Configure Location IDs

Update the location data in `src/utils/locationData.ts` with your actual Waitwhile location IDs:

```typescript
// Example: Replace placeholder IDs with real Waitwhile location IDs
locationInfo: {
  gate: 'A18',
  landmark: 'Delta Help Desk',
  airportCode: 'ATL',
  imageUrl: '/images/stores/atl-a.webp',
  customLocation: 'Located near the main rotunda...',
  customHours: '7am - 7pm ET',
  displayName: 'Concourse A',
  waitwhileLocationId: 'PSpPokkQXjTJzFcWskcU'
}
```

## Step 3: Waitwhile Account Setup

### Getting Your API Key
1. Log into your Waitwhile dashboard
2. Go to **Settings** → **Developer** → **API Keys**
3. Create a new API key with appropriate permissions:
   - `customers:create`
   - `customers:read`
   - `visits:create`
   - `visits:read`
   - `locations:read`

### Getting Location IDs
1. In Waitwhile dashboard, go to **Locations**
2. For each airport location:
   - Click on the location
   - Copy the location ID from the URL or settings
   - Update the corresponding `waitwhileLocationId` in `locationData.ts`

### Setting Up Services (Optional)
1. In Waitwhile, go to **Services**
2. Create services that match your treatments:
   - Body on the Go ($69, 10 min)
   - Total Wellness ($99, 20 min)
   - Sciatica & Lower Back Therapy ($119, 20 min)
   - Neck & Upper Back Therapy ($119, 20 min)
   - Trigger Point Therapy & Stretch ($89, 20 min)
   - Chiro Massage ($79, 20 min)
   - Chiro Massage Mini ($39, 10 min)

## Step 4: Testing the Integration

### 1. Start Development Server
```bash
npm run dev
```

### 2. Test Form Submission
1. Navigate to any location page (e.g., `/locations/atlanta/concourse-a`)
2. Fill out the form completely
3. Submit and check:
   - Browser network tab for API calls
   - Server logs for debug information
   - Waitwhile dashboard for new customers/visits

### 3. Test API Endpoints Directly

**Submit a customer:**
```bash
curl -X POST http://localhost:3000/api/waitwhile/submit \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com",
    "birthday": "01/15/1990",
    "discomfort": ["Lower back", "Neck"],
    "additionalInfo": "First time visit",
    "selectedTreatment": {
      "title": "Total Wellness",
      "price": "$99",
      "time": "20 min",
      "description": "Our signature service"
    },
    "spinalAdjustment": true,
    "locationId": "PSpPokkQXjTJzFcWskcU"
  }'
```

**Check visit status:**
```bash
curl http://localhost:3000/api/waitwhile/visit/[visit-id]
```

## Step 5: Debugging

### Enable Debug Mode
Set in `.env.local`:
```env
NEXT_PUBLIC_DEBUG_MODE=true
```

This will show detailed logs in the browser console and server logs.

### Common Issues

**1. API Key Invalid**
- Error: `401 Unauthorized`
- Solution: Verify API key in Waitwhile dashboard

**2. Location ID Not Found**
- Error: `Location not found`
- Solution: Check location IDs in Waitwhile dashboard

**3. Rate Limiting**
- Error: `429 Too Many Requests`
- Solution: Implement retry logic or reduce request frequency

**4. CORS Issues**
- Error: CORS policy blocked
- Solution: Ensure API routes are properly configured

### Log Files
- Client-side logs: Browser console
- Server-side logs: Terminal running `npm run dev`
- API logs: Check Waitwhile dashboard API logs

## Step 6: Production Deployment

### Environment Variables
Set these in your production environment:
```env
WAITWHILE_API_KEY=your_production_api_key
WAITWHILE_API_URL=https://api.waitwhile.com/v2
WAITWHILE_WEBHOOK_SECRET=your_production_webhook_secret
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### Security Considerations
1. **Never expose API keys** in client-side code
2. **Use HTTPS** in production
3. **Validate all input** server-side
4. **Rate limit** API endpoints
5. **Monitor API usage** in Waitwhile dashboard

### Performance Optimization
1. **Cache location data** to reduce API calls
2. **Implement retry logic** for failed requests
3. **Use connection pooling** for database connections
4. **Monitor response times** and optimize slow endpoints

## API Reference

### POST /api/waitwhile/submit
Creates a customer and visit in Waitwhile.

**Request Body:**
```typescript
{
  name: string;
  phone: string;
  email: string;
  birthday: string; // MM/DD/YYYY format
  discomfort: string[];
  additionalInfo?: string;
  selectedTreatment: {
    title: string;
    price: string;
    time: string;
    description: string;
  } | null;
  spinalAdjustment: boolean | null;
  locationId: string;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    visit: {
      id: string;
      status: string;
      queuePosition?: number;
      estimatedWaitTime?: number;
    };
  };
  message: string;
}
```

### GET /api/waitwhile/visit/[visitId]
Gets the current status of a visit.

**Response:**
```typescript
{
  success: true;
  data: {
    id: string;
    status: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
    waitTime?: number;
    serviceName?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}
```

## Troubleshooting

### Getting Help
1. Check Waitwhile API documentation
2. Review server logs for error details
3. Test API endpoints directly with curl/Postman
4. Verify environment variables are set correctly

### Contact Information
- Waitwhile Support: support@waitwhile.com
- Waitwhile Documentation: https://docs.waitwhile.com/ 