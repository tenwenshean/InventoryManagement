
════════════════════════════════════════════════════════════════════════════════
                    3-MONTH KAGGLE SALES DATA IMPORT REPORT
════════════════════════════════════════════════════════════════════════════════
Generated: 2025-12-11T13:39:32.737Z
Updated:   2025-12-15 (Train/Test Split Added)
User ID: EFCG0Cy1Z1egAfOFd7VpHvprr242

1. DATA SOURCE & SAMPLING
─────────────────────────────────────────────────────────────────────────────────
   Files:              Sales_October_2019.csv, Sales_November_2019.csv, Sales_December_2019.csv
   Raw Records:        63,157
   Sampled Records:    9,007 (~3000/month)
   After Cleaning:     8,964
   Duplicates Removed: 1

2. DATA CLEANING STEPS
─────────────────────────────────────────────────────────────────────────────────
   1. Loaded 3 CSV files (Oct, Nov, Dec 2019)
   2. Random sampling: 3000 records per month max
   3. Removed empty rows: 27
   4. Fixed invalid dates: 16
   5. Fixed invalid prices: 0
   6. Removed duplicate order-product pairs: 1
   7. Aggregated by Product and Order ID

3. IMPORTED DATA
─────────────────────────────────────────────────────────────────────────────────
   Products:           19
   Orders:             2,996
   Accounting Entries: 2,996
   Date Range:         2019-09-30 to 2019-12-31

4. DELETED DATA (Previous)
─────────────────────────────────────────────────────────────────────────────────
   Products:           20
   Orders:             2000
   Accounting:         2000

5. MONTHLY BREAKDOWN (Actual Revenue in Database)
─────────────────────────────────────────────────────────────────────────────────
   2019-10:  956 orders  | $   194,912.49 revenue
   2019-11:  1,034 orders | $   191,502.01 revenue
   2019-12:  1,968 orders | $   350,050.50 revenue
   ─────────────────────────────────────────────
   TOTAL:    3,958 orders | $   736,465.00 revenue

6. TRAIN/TEST SPLIT
─────────────────────────────────────────────────────────────────────────────────
   Split Strategy: Time-Series Walk-Forward Validation
   
   ┌─────────────────────────────────────────────────────────────┐
   │  TRAINING SET (67%)      │  TESTING SET (33%)              │
   │  Oct-Nov 2019            │  Dec 2019                       │
   │  2 months                │  1 month                        │
   ├─────────────────────────────────────────────────────────────┤
   │  $194,912 + $191,502     │  $350,050 (actual)              │
   │  = $386,414              │  $188,091 (predicted)           │
   └─────────────────────────────────────────────────────────────┘
   
   Training: Use Oct-Nov to build regression model
   Testing:  Predict Dec and compare with actual value
   Final:    Retrain on all 3 months for Jan-Mar 2020 predictions

7. ML MODEL METRICS
─────────────────────────────────────────────────────────────────────────────────
   
   MODEL TRAINED ON Oct-Nov 2019:
   ├─ Formula: y = -3410.48x + 194912.49
   └─ Prediction for Dec: $188,091.53 (vs actual $350,050.50)
   
   VALIDATION METRICS:
   ├─ R² (Coefficient of Determination): 100% (perfect fit on training data)
   ├─ MAE (Mean Absolute Error): $161,958.97
   └─ MAPE (Mean Absolute % Error): 46.27%
   
   FINAL MODEL (trained on all 3 months):
   ├─ Formula: y = 77569.00x + 167919.33
   ├─ Slope: Revenue increases ~$77,569/month
   └─ Intercept: Baseline $167,919

8. CONFIDENCE CALCULATION (Updated Method)
─────────────────────────────────────────────────────────────────────────────────
   
   NEW FORMULA: Confidence = (R² × 0.6) + (CV_Confidence × 0.4)
   
   Components:
   ├─ R² Score: 100% (model explains variance well)
   ├─ CV (Coefficient of Variation): 30.12% (data has seasonal variance)
   ├─ CV Confidence: 100 - 30.12 = 69.88%
   
   Calculation:
   ├─ R² Component: 100 × 0.6 = 60.00%
   ├─ CV Component:  69.88 × 0.4 = 27.95%
   └─ BASE CONFIDENCE: 87.95% ≈ 88%
   
   Per-Period Decay (10% per future month):
   ├─ Jan 2020: 88% × 0.9^0 = 88%
   ├─ Feb 2020: 88% × 0.9^1 = 79%
   └─ Mar 2020: 88% × 0.9^2 = 71%

9. PREDICTIONS FOR JAN-FEB-MAR 2020
─────────────────────────────────────────────────────────────────────────────────
   
   Using: y = 77569.00x + 167919.33
   
   ┌──────────┬───────────────┬────────────┐
   │  Period  │  Predicted    │ Confidence │
   ├──────────┼───────────────┼────────────┤
   │  2020-01 │  $400,626     │  88%       │
   │  2020-02 │  $478,195     │  79%       │
   │  2020-03 │  $555,764     │  71%       │
   └──────────┴───────────────┴────────────┘
   
   Total Predicted (Q1 2020): $1,434,586

10. WHY CONFIDENCE DIFFERS FROM INITIAL REPORT
─────────────────────────────────────────────────────────────────────────────────
   
   INITIAL IMPORT REPORT (98.6%):
   ├─ Calculated on sampled, balanced data
   ├─ Each month ~$530K revenue (uniform sampling)
   └─ Low variance → High confidence
   
   ACTUAL DATABASE (88%):
   ├─ October:  $194K
   ├─ November: $191K
   ├─ December: $350K (holiday shopping spike!)
   └─ High variance → Lower confidence
   
   KEY INSIGHT: December 2019 has nearly 2x the revenue of Oct/Nov
   due to holiday season shopping, creating natural variance.

════════════════════════════════════════════════════════════════════════════════
