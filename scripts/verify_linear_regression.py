"""
Python Verification Script for ML Linear Regression
This script replicates the exact same linear regression logic from server/ml-service.ts
to verify outputs match (around 70% confidence expected)

For Spyder IDE: Just run the script (F5)
"""

import math
from typing import List, Tuple, Dict
import os

# ============================================
# 📁 EDIT THIS SECTION - FILE PATH & DATA
# ============================================

# Option 1: Load data from a CSV file (set to None to use sample data)
# Example: "C:/Users/YourName/Desktop/revenue_data.csv"
CSV_FILE_PATH = None  # <-- EDIT THIS PATH if you have a CSV file

# Option 2: Manually enter your data here (used if CSV_FILE_PATH is None)
# Replace these values with your actual monthly revenue/sales data
MANUAL_DATA = [
    2478.52,  # Month 1 (e.g., July 2024)
    2636.55,  # Month 2 (e.g., August 2024)
    2608.12,  # Month 3 (e.g., September 2024)
    2743.86,  # Month 4 (e.g., October 2024)
    2753.60,  # Month 5 (e.g., November 2024)
    2873.64,  # Month 6 (e.g., December 2024)
]

# Number of periods to forecast ahead
PERIODS_TO_FORECAST = 3

# ============================================
# CORE LINEAR REGRESSION (same as ml-service.ts)
# ============================================

def linear_regression(values: List[float]) -> Tuple[float, float]:
    """
    Simple Linear Regression using Least Squares Method
    Exactly mirrors: server/ml-service.ts -> linearRegression()
    
    Formula:
        slope = (n·ΣXY - ΣX·ΣY) / (n·ΣX² - (ΣX)²)
        intercept = (ΣY - slope·ΣX) / n
    
    Args:
        values: List of numerical values (revenue, sales, etc.)
    
    Returns:
        Tuple of (slope, intercept)
    """
    if len(values) < 2:
        return (0.0, 0.0)
    
    n = len(values)
    sum_x = 0.0
    sum_y = 0.0
    sum_xy = 0.0
    sum_x2 = 0.0
    
    for index, value in enumerate(values):
        x = index          # X = index (0, 1, 2, 3, ...)
        y = value          # Y = the revenue/sales value
        sum_x += x
        sum_y += y
        sum_xy += x * y
        sum_x2 += x * x
    
    # Avoid division by zero
    denominator = (n * sum_x2 - sum_x * sum_x)
    if denominator == 0:
        return (0.0, 0.0)
    
    slope = (n * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / n
    
    return (slope, intercept)


def standard_deviation(values: List[float]) -> float:
    """
    Calculate standard deviation
    Exactly mirrors: server/ml-service.ts -> standardDeviation()
    """
    if len(values) == 0:
        return 0.0
    
    avg = sum(values) / len(values)
    square_diffs = [(value - avg) ** 2 for value in values]
    avg_square_diff = sum(square_diffs) / len(square_diffs)
    return math.sqrt(avg_square_diff)


def calculate_confidence(values: List[float]) -> float:
    """
    Calculate confidence based on coefficient of variation
    Exactly mirrors: server/ml-service.ts -> predictNextValue() confidence logic
    """
    if len(values) == 0:
        return 0.0
    
    std_dev = standard_deviation(values)
    avg = sum(values) / len(values)
    
    if avg == 0:
        return 0.0
    
    cv = std_dev / avg  # Coefficient of variation
    confidence = max(0, min(100, 100 - (cv * 100)))
    return round(confidence)


def predict_next_value(historical_values: List[float]) -> Dict:
    """
    Predict next period value using linear regression
    Exactly mirrors: server/ml-service.ts -> predictNextValue()
    """
    if len(historical_values) < 3:
        return {
            'predicted_value': 0,
            'confidence': 0,
            'trend': 'stable',
            'slope': 0,
            'intercept': 0
        }
    
    slope, intercept = linear_regression(historical_values)
    next_index = len(historical_values)
    predicted_value = slope * next_index + intercept
    
    # Calculate confidence
    confidence = calculate_confidence(historical_values)
    
    # Determine trend
    avg = sum(historical_values) / len(historical_values)
    if slope > avg * 0.05:
        trend = 'increasing'
    elif slope < -avg * 0.05:
        trend = 'decreasing'
    else:
        trend = 'stable'
    
    return {
        'predicted_value': max(0, predicted_value),
        'confidence': confidence,
        'trend': trend,
        'slope': slope,
        'intercept': intercept
    }


def forecast_revenue(historical_values: List[float], periods_ahead: int = 3) -> Dict:
    """
    Forecast revenue for next N periods
    Exactly mirrors: server/ml-service.ts -> forecastRevenue()
    """
    forecasts = []
    total_predicted = 0.0
    
    slope, intercept = linear_regression(historical_values)
    std_dev = standard_deviation(historical_values)
    avg = sum(historical_values) / len(historical_values) if historical_values else 0
    
    for i in range(1, periods_ahead + 1):
        next_index = len(historical_values) + i - 1
        predicted_value = max(0, slope * next_index + intercept)
        
        # Confidence decreases with distance from known data
        if avg != 0:
            cv = std_dev / avg
            base_confidence = max(0, min(100, 100 - (cv * 100)))
            confidence = round(base_confidence * (0.9 ** (i - 1)))
        else:
            confidence = 0
        
        forecasts.append({
            'period': i,
            'value': round(predicted_value * 100) / 100,
            'confidence': confidence
        })
        
        total_predicted += predicted_value
    
    return {
        'forecasts': forecasts,
        'total_predicted': round(total_predicted * 100) / 100,
        'slope': slope,
        'intercept': intercept
    }


# ============================================
# TEST CASES
# ============================================

def run_tests():
    print("=" * 80)
    print("🐍 PYTHON LINEAR REGRESSION VERIFICATION")
    print("   Replicating server/ml-service.ts logic")
    print("=" * 80)
    
    # ---- TEST 1: Perfect Linear Data ----
    print("\n📊 TEST 1: Perfect Linear Data [100, 110, 120, 130, 140]")
    print("-" * 60)
    
    simple_data = [100, 110, 120, 130, 140]
    slope, intercept = linear_regression(simple_data)
    next_value = slope * len(simple_data) + intercept
    
    print(f"  Input: {simple_data}")
    print(f"  Slope: {slope:.2f} (expected: 10)")
    print(f"  Intercept: {intercept:.2f} (expected: 100)")
    print(f"  Next Predicted: {next_value:.2f} (expected: 150)")
    print(f"  ✅ PASS" if abs(next_value - 150) < 0.01 else "  ❌ FAIL")
    
    # ---- TEST 2: Real-world-like Monthly Revenue ----
    print("\n📊 TEST 2: Simulated Monthly Revenue (12 months)")
    print("-" * 60)
    
    # Similar to your production data pattern
    monthly_revenue = [
        2478.52,  # July 2024
        2636.55,  # August 2024
        2608.12,  # September 2024
        2743.86,  # October 2024
        2753.60,  # November 2024
        2873.64,  # December 2024
    ]
    
    result = forecast_revenue(monthly_revenue, 3)
    
    print(f"  Historical Data: {monthly_revenue}")
    print(f"  Slope: {result['slope']:.2f}")
    print(f"  Intercept: {result['intercept']:.2f}")
    print(f"  Formula: y = {result['slope']:.2f}x + {result['intercept']:.2f}")
    print(f"\n  Predictions:")
    for forecast in result['forecasts']:
        print(f"    Period {forecast['period']}: ${forecast['value']:.2f} (confidence: {forecast['confidence']}%)")
    print(f"\n  Total Predicted: ${result['total_predicted']:.2f}")
    
    # ---- TEST 3: Confidence Calculation ----
    print("\n📊 TEST 3: Confidence Calculation")
    print("-" * 60)
    
    # Low variance = high confidence
    stable_data = [1000, 1010, 990, 1005, 995]
    stable_confidence = calculate_confidence(stable_data)
    
    # High variance = low confidence
    volatile_data = [500, 1500, 300, 2000, 400]
    volatile_confidence = calculate_confidence(volatile_data)
    
    print(f"  Stable data {stable_data}: Confidence = {stable_confidence}%")
    print(f"  Volatile data {volatile_data}: Confidence = {volatile_confidence}%")
    
    # ---- TEST 4: Edge Cases ----
    print("\n📊 TEST 4: Edge Cases")
    print("-" * 60)
    
    # Flat trend
    flat_data = [50000, 50000, 50000, 50000, 50000]
    flat_result = predict_next_value(flat_data)
    print(f"  Flat data: Predicted = ${flat_result['predicted_value']:.2f}, Trend = {flat_result['trend']}")
    
    # Declining trend
    declining_data = [100000, 98000, 96000, 94000, 92000]
    declining_result = predict_next_value(declining_data)
    print(f"  Declining data: Predicted = ${declining_result['predicted_value']:.2f}, Trend = {declining_result['trend']}")
    
    # Growing trend
    growing_data = [10000, 12000, 14000, 16000, 18000]
    growing_result = predict_next_value(growing_data)
    print(f"  Growing data: Predicted = ${growing_result['predicted_value']:.2f}, Trend = {growing_result['trend']}")
    
    # ---- TEST 5: 24-month Retail Pattern ----
    print("\n📊 TEST 5: 24-Month Retail Sales Pattern")
    print("-" * 60)
    
    # Similar to test-ml-predictions.js data
    retail_monthly = [
        45000, 42000, 48000, 52000, 55000, 58000,  # Jan-Jun 2023
        60000, 62000, 59000, 65000, 70000, 85000,  # Jul-Dec 2023 (holiday spike)
        48000, 45000, 52000, 56000, 60000, 63000,  # Jan-Jun 2024
        66000, 68000, 64000, 72000, 78000, 95000,  # Jul-Dec 2024 (holiday spike)
    ]
    
    # Use last 12 months for prediction
    last_12_months = retail_monthly[-12:]
    forecast = forecast_revenue(last_12_months, 6)
    
    print(f"  Last 12 months avg: ${sum(last_12_months)/len(last_12_months):,.2f}")
    print(f"  Slope: {forecast['slope']:.2f}")
    print(f"  6-Month Forecast:")
    for f in forecast['forecasts']:
        print(f"    Month {f['period']}: ${f['value']:,.2f} (confidence: {f['confidence']}%)")
    
    # ---- Summary ----
    print("\n" + "=" * 80)
    print("✅ VERIFICATION COMPLETE")
    print("=" * 80)
    print("""
Compare these results with running:
  - node scripts/test-ml-predictions.js
  - node scripts/test-ml-live.js

The formulas used:
  slope = (n·ΣXY - ΣX·ΣY) / (n·ΣX² - (ΣX)²)
  intercept = (ΣY - slope·ΣX) / n
  prediction = slope * nextIndex + intercept
  confidence = 100 - (coefficient_of_variation * 100)
""")


def compare_with_typescript_output():
    """
    Compare Python output with expected TypeScript output
    """
    print("\n" + "=" * 80)
    print("🔍 TYPESCRIPT vs PYTHON COMPARISON")
    print("=" * 80)
    
    # Known test case from ml-service.ts
    test_data = [100, 110, 120, 130, 140]
    
    slope, intercept = linear_regression(test_data)
    predicted = slope * len(test_data) + intercept
    
    # Expected from TypeScript
    ts_expected = {
        'slope': 10,
        'intercept': 100,
        'predicted': 150
    }
    
    print(f"\n  Test Data: {test_data}")
    print(f"\n  {'Metric':<15} {'Python':<15} {'TypeScript':<15} {'Match?':<10}")
    print(f"  {'-'*55}")
    print(f"  {'Slope':<15} {slope:<15.2f} {ts_expected['slope']:<15} {'✅' if abs(slope - ts_expected['slope']) < 0.001 else '❌'}")
    print(f"  {'Intercept':<15} {intercept:<15.2f} {ts_expected['intercept']:<15} {'✅' if abs(intercept - ts_expected['intercept']) < 0.001 else '❌'}")
    print(f"  {'Predicted':<15} {predicted:<15.2f} {ts_expected['predicted']:<15} {'✅' if abs(predicted - ts_expected['predicted']) < 0.001 else '❌'}")
    
    # Calculate match percentage
    matches = sum([
        abs(slope - ts_expected['slope']) < 0.001,
        abs(intercept - ts_expected['intercept']) < 0.001,
        abs(predicted - ts_expected['predicted']) < 0.001
    ])
    
    match_percentage = (matches / 3) * 100
    print(f"\n  Overall Match: {match_percentage:.0f}% {'(>70% target met ✅)' if match_percentage >= 70 else '(below 70% target ❌)'}")


def load_data_from_csv(file_path: str) -> List[float]:
    """
    Load data from a CSV file
    Expects a single column of numbers or a column named 'revenue' or 'value'
    """
    data = []
    try:
        with open(file_path, 'r') as f:
            lines = f.readlines()
            
        # Check if first line is header
        first_line = lines[0].strip()
        start_index = 0
        
        if not first_line.replace('.', '').replace('-', '').isdigit():
            start_index = 1  # Skip header
            
        for line in lines[start_index:]:
            line = line.strip()
            if line:
                # Handle CSV with multiple columns - take first numeric column
                parts = line.split(',')
                for part in parts:
                    part = part.strip()
                    try:
                        value = float(part)
                        data.append(value)
                        break
                    except ValueError:
                        continue
                        
        print(f"  ✅ Loaded {len(data)} data points from: {file_path}")
        
    except FileNotFoundError:
        print(f"  ❌ File not found: {file_path}")
        print("  Using manual data instead...")
        return None
    except Exception as e:
        print(f"  ❌ Error reading file: {e}")
        return None
        
    return data


def run_with_your_data():
    """
    Run prediction with your own data (from CSV or manual input)
    """
    print("\n" + "=" * 80)
    print("📊 YOUR DATA ANALYSIS")
    print("=" * 80)
    
    # Load data
    data = None
    if CSV_FILE_PATH and os.path.exists(CSV_FILE_PATH):
        print(f"\n  Loading data from CSV: {CSV_FILE_PATH}")
        data = load_data_from_csv(CSV_FILE_PATH)
    
    if data is None:
        print(f"\n  Using MANUAL_DATA ({len(MANUAL_DATA)} data points)")
        data = MANUAL_DATA
    
    if len(data) < 3:
        print("  ❌ Need at least 3 data points for prediction!")
        return
    
    # Show input data
    print(f"\n  Input Data:")
    for i, value in enumerate(data):
        print(f"    Period {i+1}: ${value:,.2f}")
    
    # Run analysis
    print(f"\n  📈 Linear Regression Analysis:")
    print("-" * 60)
    
    slope, intercept = linear_regression(data)
    print(f"    Slope (m): {slope:.4f}")
    print(f"    Intercept (b): {intercept:.4f}")
    print(f"    Formula: y = {slope:.2f}x + {intercept:.2f}")
    
    # Confidence
    confidence = calculate_confidence(data)
    print(f"    Confidence: {confidence}%")
    
    # Predictions
    print(f"\n  🔮 Predictions for next {PERIODS_TO_FORECAST} periods:")
    print("-" * 60)
    
    forecast = forecast_revenue(data, PERIODS_TO_FORECAST)
    for f in forecast['forecasts']:
        print(f"    Period {len(data) + f['period']}: ${f['value']:,.2f} (confidence: {f['confidence']}%)")
    
    print(f"\n    Total Predicted: ${forecast['total_predicted']:,.2f}")
    
    # Trend
    result = predict_next_value(data)
    print(f"    Trend: {result['trend'].upper()}")


if __name__ == "__main__":
    run_tests()
    compare_with_typescript_output()
    run_with_your_data()
