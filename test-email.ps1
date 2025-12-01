# Test Email Script
# This sends a test email using the running development server

Write-Host "Testing Email Notification System..." -ForegroundColor Cyan
Write-Host ""

# Get Firebase token from user
$token = Read-Host "Please paste your Firebase Auth Token (from browser localStorage)"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "Error: No token provided!" -ForegroundColor Red
    exit 1
}

# Email to send to
$email = "tenwenshean@gmail.com"
$type = "low-stock"

Write-Host "Sending test email to: $email" -ForegroundColor Yellow
Write-Host "Email type: $type" -ForegroundColor Yellow
Write-Host ""

# Prepare request
$body = @{
    email = $email
    type = $type
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/notifications/test-email" -Method POST -Body $body -Headers $headers
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Check your email inbox at: $email" -ForegroundColor Cyan
} catch {
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    
    # Try to read error response
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error Details: $errorBody" -ForegroundColor Red
    } catch {
        # Ignore
    }
}

Write-Host ""
Write-Host "To get your token:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:5000 and log in" -ForegroundColor White
Write-Host "2. Press F12 to open Developer Tools" -ForegroundColor White
Write-Host "3. Go to Console tab" -ForegroundColor White
Write-Host "4. Type: localStorage.getItem('firebaseToken')" -ForegroundColor White
Write-Host "5. Copy the token (without quotes) and paste it when running this script" -ForegroundColor White
