/**
 * Import Kaggle Sales Dataset into Inventory Management System
 * This script converts the Kaggle retail sales CSV into products and orders
 * to test ML predictions on the frontend
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../firebase-key.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Parse CSV data
const csvData = `Date,Customer_ID,Product_ID,Quantity,Unit_Price,Sales_Revenue,Product_Description,Product_Category,Product_Line,Raw_Material,Region,Latitude,Longitude
20210601,98,321,1,117.3060162,117.3060162,Cycling Jerseys,Sports,Tops,Fabrics,York,53.958332,-1.080278
20210602,92,261,4,32.27240332,129.0896133,Casual Shirts,Menswear,Tops,Cotton,Worcester,52.192001,-2.22
20210603,92,264,1,36.19336404,36.19336404,Casual Shirts,Menswear,Tops,Cotton,Worcester,52.192001,-2.22
20210604,99,251,3,29.91340346,89.74021037,Jeans,Menswear,Trousers,Cotton,Winchester,51.063202,-1.308
20210605,66,251,1,41.84343048,41.84343048,Shorts,Womenswear,Trousers,Cotton,Winchester,51.063202,-1.308
20210606,97,304,3,49.88752415,149.6625725,Belts,Accessories,Leathers,Leather,Wells,51.209,-2.647
20210607,45,357,2,35.41601593,70.83203185,Ties,Accessories,Tops,Leather,Wakefield,53.68,-1.49
20210608,81,258,1,29.08420533,29.08420533,Polo Shirts,Menswear,Tops,Cotton,Wakefield,53.68,-1.49
20210609,47,260,3,44.49807734,133.494232,Tshirts,Womenswear,Tops,Cotton,Wakefield,53.68,-1.49
20210610,24,263,3,38.49739685,115.4921905,Formal Shirts,Womenswear,Tops,Wool,Winchester,51.063202,-1.308
20210611,10,265,4,27.04895601,108.195824,Formal Shirts,Menswear,Tops,Wool,Wakefield,53.68,-1.49
20210612,45,260,3,28.54089924,85.62269771,Polo Shirts,Menswear,Tops,Cotton,Wakefield,53.68,-1.49
20210613,55,260,1,34.74291321,34.74291321,Formal Shirts,Menswear,Tops,Cotton,York,53.958332,-1.080278
20210614,44,286,3,27.02857115,81.08571344,Knitwear,Womenswear,Tops,Cashmere,Wells,51.209,-2.647
20210615,97,291,1,34.79245255,34.79245255,Knitwear,Menswear,Tops,Cashmere,Wells,51.209,-2.647
20210616,31,265,4,43.871537,175.486148,Suits,Menswear,Tops,Wool,Wakefield,53.68,-1.49
20210617,47,274,1,51.96824385,51.96824385,Sweats,Womenswear,Tops,Polyester,Wakefield,53.68,-1.49
20210618,47,276,4,33.93177484,135.7270994,Shorts,Womenswear,Tops,Cotton,Wakefield,53.68,-1.49
20210619,98,280,3,41.41250434,124.237513,Pants,Womenswear,Trousers,Cotton,York,53.958332,-1.080278
20210620,34,273,1,38.51621801,38.51621801,Pants,Womenswear,Trousers,Cotton,Wakefield,53.68,-1.49
20210621,90,336,1,21.96581177,21.96581177,GolfShoes,Sports,Shoes,Leather,Truro,50.259998,-5.051
20210622,12,293,2,38.71883954,77.43767908,Dress,Womenswear,Tops,Polyester,Truro,50.259998,-5.051
20210623,9,285,3,36.19045837,108.5713751,Coats,Womenswear,Tops,Cotton,Truro,50.259998,-5.051
20210624,66,276,1,54.99430496,54.99430496,Underwear,Womenswear,Tops,Cotton,Winchester,51.063202,-1.308
20210625,89,277,2,50.79595734,101.5919147,Pyjamas,Womenswear,Tops,Cotton,Truro,50.259998,-5.051
20210626,32,278,2,47.43331644,94.86663288,Pyjamas,Menswear,Tops,Cotton,Truro,50.259998,-5.051
20210627,15,288,1,50.00261903,50.00261903,Pants,Menswear,Trousers,Leather,Worcester,52.192001,-2.22
20210628,56,262,1,33.47093586,33.47093586,Formal Shirts,Menswear,Tops,Wool,York,53.958332,-1.080278
20210629,13,286,1,32.74550663,32.74550663,Knitwear,Womenswear,Tops,Cashmere,Wells,51.209,-2.647
20210630,91,291,1,31.87910676,31.87910676,Knitwear,Menswear,Tops,Cashmere,Wells,51.209,-2.647`;

function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index];
    });
    return obj;
  });
}

function parseDate(dateString) {
  // Format: YYYYMMDD
  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  return new Date(`${year}-${month}-${day}`);
}

async function importKaggleData(userId) {
  console.log('🔄 Starting Kaggle Sales Data Import...\n');
  
  const salesData = parseCSV(csvData);
  
  // Group by Product_ID to create unique products
  const productsMap = new Map();
  const ordersByDate = new Map();
  
  salesData.forEach(row => {
    const productId = `KAGGLE-${row.Product_ID}`;
    
    // Create/update product
    if (!productsMap.has(productId)) {
      productsMap.set(productId, {
        id: productId,
        name: row.Product_Description,
        category: row.Product_Category,
        price: parseFloat(row.Unit_Price),
        stock: 0,
        totalSold: 0,
        totalRevenue: 0,
        material: row.Raw_Material,
        productLine: row.Product_Line,
        userId: userId,
        createdAt: parseDate(row.Date)
      });
    }
    
    // Update product stats
    const product = productsMap.get(productId);
    const quantity = parseInt(row.Quantity);
    const revenue = parseFloat(row.Sales_Revenue);
    
    product.totalSold += quantity;
    product.totalRevenue += revenue;
    product.stock += quantity * 2; // Set initial stock higher than sold
    
    // Group orders by date
    const dateKey = row.Date;
    if (!ordersByDate.has(dateKey)) {
      ordersByDate.set(dateKey, []);
    }
    
    ordersByDate.get(dateKey).push({
      productId,
      productName: row.Product_Description,
      quantity,
      price: parseFloat(row.Unit_Price),
      revenue,
      customerId: `CUST-${row.Customer_ID}`,
      date: parseDate(row.Date),
      region: row.Region
    });
  });
  
  console.log(`📦 Creating ${productsMap.size} unique products...`);
  
  // Import products
  let productCount = 0;
  for (const [productId, product] of productsMap.entries()) {
    await db.collection('products').doc(productId).set(product);
    productCount++;
    if (productCount % 10 === 0) {
      console.log(`   ✓ ${productCount} products created...`);
    }
  }
  
  console.log(`✅ ${productCount} products created!\n`);
  
  console.log(`🛒 Creating orders from ${ordersByDate.size} days of sales...`);
  
  // Create orders (one per day combining all sales)
  let orderCount = 0;
  for (const [dateKey, items] of ordersByDate.entries()) {
    const date = parseDate(dateKey);
    const orderId = `KAGGLE-ORDER-${dateKey}`;
    
    const totalAmount = items.reduce((sum, item) => sum + item.revenue, 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    
    const order = {
      orderNumber: orderId,
      customerId: items[0].customerId,
      sellerId: userId,
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.revenue,
        sellerId: userId
      })),
      totalAmount,
      status: 'completed',
      paymentStatus: 'paid',
      createdAt: date,
      updatedAt: date,
      region: items[0].region
    };
    
    await db.collection('orders').doc(orderId).set(order);
    
    // Create accounting entries
    const accountingEntry = {
      userId,
      date,
      type: 'sale',
      category: 'Product Sales',
      description: `Kaggle sales data - ${totalQuantity} items sold`,
      revenue: totalAmount,
      expense: totalAmount * 0.6, // Assume 60% COGS
      profit: totalAmount * 0.4,
      orderId,
      createdAt: date
    };
    
    await db.collection('accountingEntries').add(accountingEntry);
    
    orderCount++;
    if (orderCount % 5 === 0) {
      console.log(`   ✓ ${orderCount} orders created...`);
    }
  }
  
  console.log(`✅ ${orderCount} orders created!\n`);
  
  // Generate summary
  const totalRevenue = Array.from(productsMap.values())
    .reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalItemsSold = Array.from(productsMap.values())
    .reduce((sum, p) => sum + p.totalSold, 0);
  
  console.log('═'.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ Products Created: ${productCount}`);
  console.log(`✅ Orders Created: ${orderCount}`);
  console.log(`✅ Accounting Entries: ${orderCount}`);
  console.log(`💰 Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`📦 Total Items Sold: ${totalItemsSold}`);
  console.log(`📅 Date Range: June 1-30, 2021`);
  console.log('═'.repeat(60));
  console.log('\n✨ Data import complete! You can now test ML predictions on the frontend.');
  console.log('\n📍 Next Steps:');
  console.log('   1. Go to the Reports page to see ML predictions');
  console.log('   2. Check Dashboard for sales analytics');
  console.log('   3. View Products to see imported items');
  console.log('   4. Check Accounting for revenue entries\n');
}

// Get userId from command line or use default
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Error: Please provide a userId as argument');
  console.log('\nUsage: npx tsx scripts/import-kaggle-sales.js YOUR_USER_ID');
  console.log('\nTo find your userId:');
  console.log('  1. Login to your app');
  console.log('  2. Open browser console');
  console.log('  3. Type: localStorage.getItem("user")');
  console.log('  4. Look for the "uid" field\n');
  process.exit(1);
}

importKaggleData(userId)
  .then(() => {
    console.log('✅ Import script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error importing data:', error);
    process.exit(1);
  });
