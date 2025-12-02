# Email Notification Test Script
# Run this after logging into your app to get the token

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Email Notification System Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
Write-Host "📝 Configuration Setup" -ForegroundColor Yellow
Write-Host ""

$testEmail = Read-Host "Enter your email address to receive test emails"

Write-Host ""
Write-Host "Choose test environment:" -ForegroundColor Yellow
Write-Host "1) Local (http://localhost:5000)"
Write-Host "2) Production (Vercel)"
$envChoice = Read-Host "Enter choice (1 or 2)"

if ($envChoice -eq "1") {
    $baseUrl = "http://localhost:5000"
    Write-Host "✅ Testing LOCAL environment" -ForegroundColor Green
} else {
    $vercelUrl = Read-Host "Enter your Vercel URL (e.g., https://your-app.vercel.app)"
    $baseUrl = $vercelUrl
    Write-Host "✅ Testing PRODUCTION environment" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔑 Getting authentication token..." -ForegroundColor Yellow
Write-Host "INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "1. Open your app in a browser and log in"
Write-Host "2. Press F12 to open Developer Tools"
Write-Host "3. Go to Console tab"
Write-Host "4. Type: localStorage.getItem('token')"
Write-Host "5. Copy the token value (without quotes)"
Write-Host ""

$token = Read-Host "Paste your authentication token here"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "❌ Error: Token cannot be empty!" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Running Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Daily Report
Write-Host "📊 Test 1: Daily Report (with low stock alerts)" -ForegroundColor Yellow
Write-Host "Endpoint: $baseUrl/api/notifications/test-email" -ForegroundColor Gray

try {
    $body = @{
        type = "daily-report"
        email = $testEmail
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/notifications/test-email" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✅ SUCCESS: Daily report test email sent!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}

Write-Host ""

# Test 2: Weekly Summary
Write-Host "📈 Test 2: Weekly Summary (with low stock alerts)" -ForegroundColor Yellow
Write-Host "Endpoint: $baseUrl/api/notifications/test-email" -ForegroundColor Gray

try {
    $body = @{
        type = "weekly-summary"
        email = $testEmail
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/notifications/test-email" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✅ SUCCESS: Weekly summary test email sent!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📬 Check your email inbox at: $testEmail" -ForegroundColor Yellow
Write-Host "💡 Also check your spam/junk folder!" -ForegroundColor Yellow
Write-Host ""
Write-Host "You should receive 2 emails:" -ForegroundColor Cyan
Write-Host "  1. 📊 Daily Business Report (with low stock section)" -ForegroundColor Gray
Write-Host "  2. 📈 Weekly Business Summary (with low stock section)" -ForegroundColor Gray
Write-Host ""

# Optional: Test cron endpoints
Write-Host "Would you like to test the CRON endpoints directly? (y/n)" -ForegroundColor Yellow
$testCron = Read-Host

if ($testCron -eq "y" -or $testCron -eq "Y") {
    Write-Host ""
    $cronSecret = Read-Host "Enter your CRON_SECRET (from .env or Vercel env vars)"
    
    if (-not [string]::IsNullOrWhiteSpace($cronSecret)) {
        Write-Host ""
        Write-Host "🔄 Testing Daily Report Cron..." -ForegroundColor Yellow
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/api/cron/daily-report" `
                -Method POST `
                -Headers @{
                    "x-cron-secret" = $cronSecret
                    "Content-Type" = "application/json"
                }
            Write-Host "✅ Daily report cron executed successfully!" -ForegroundColor Green
            Write-Host "Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
        } catch {
            Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }

        Write-Host ""
        Write-Host "🔄 Testing Weekly Summary Cron..." -ForegroundColor Yellow
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/api/cron/weekly-summary" `
                -Method POST `
                -Headers @{
                    "x-cron-secret" = $cronSecret
                    "Content-Type" = "application/json"
                }
            Write-Host "✅ Weekly summary cron executed successfully!" -ForegroundColor Green
            Write-Host "Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
        } catch {
            Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "🎉 All tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Check your email at: $testEmail" -ForegroundColor Gray
Write-Host "2. Verify low stock alerts appear if you have low stock products" -ForegroundColor Gray
Write-Host "3. If testing production, verify Vercel function logs" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"
