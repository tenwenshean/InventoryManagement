/**
 * Firebase Quota Usage Analysis
 * 
 * This script identifies patterns in the codebase that may cause high Firebase quota usage
 */

const fs = require('fs');
const path = require('path');

const HIGH_QUOTA_PATTERNS = [
  {
    name: 'Collection .get() without limit',
    pattern: /collection\(['"`][\w]+['"`]\)\.get\(\)/g,
    severity: 'HIGH',
    description: 'Fetching entire collection without pagination',
    recommendation: 'Add .limit(X) or use .where() to filter'
  },
  {
    name: 'Collection .get() with .where() but no limit',
    pattern: /collection\(['"`][\w]+['"`]\)\.where\([^)]+\)\.get\(\)/g,
    severity: 'MEDIUM',
    description: 'Filtered query without pagination',
    recommendation: 'Consider adding .limit() for large result sets'
  },
  {
    name: 'Multiple sequential .get() calls',
    pattern: /await db\.collection\(['"`][\w]+['"`]\)\.doc\([^)]+\)\.get\(\)[^}]{0,200}await db\.collection\(['"`][\w]+['"`]\)\.doc\([^)]+\)\.get\(\)/g,
    severity: 'MEDIUM',
    description: 'Sequential document reads that could be batched',
    recommendation: 'Use db.getAll() for batch reads'
  },
  {
    name: 'Get all documents then filter in code',
    pattern: /\.get\(\)[^}]{0,300}\.forEach\([^}]+if\s*\(/g,
    severity: 'HIGH',
    description: 'Fetching all documents and filtering in application code',
    recommendation: 'Move filtering to Firestore query with .where()'
  },
  {
    name: 'Dashboard/stats queries without caching',
    pattern: /(dashboard|stats|summary)[^}]{0,500}collection\([^)]+\)\.get\(\)/gi,
    severity: 'HIGH',
    description: 'Dashboard queries that run on every page load',
    recommendation: 'Implement caching or pre-aggregated stats'
  }
];

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  HIGH_QUOTA_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern.pattern);
    if (matches && matches.length > 0) {
      issues.push({
        ...pattern,
        count: matches.length,
        matches: matches.slice(0, 3) // Show first 3 examples
      });
    }
  });
  
  return issues;
}

function analyzeDirectory(dirPath, results = {}) {
  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      analyzeDirectory(fullPath, results);
    } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.ts'))) {
      const issues = analyzeFile(fullPath);
      if (issues.length > 0) {
        results[fullPath] = issues;
      }
    }
  });
  
  return results;
}

function generateReport(results) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Firebase Quota Usage Analysis Report');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  let totalIssues = 0;
  const severityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  
  Object.entries(results).forEach(([filePath, issues]) => {
    const relativePath = filePath.replace(process.cwd(), '.');
    console.log(`📄 ${relativePath}`);
    console.log('─'.repeat(70));
    
    issues.forEach(issue => {
      totalIssues += issue.count;
      severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + issue.count;
      
      const severityIcon = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟡' : '🟢';
      console.log(`\n${severityIcon} ${issue.name} (${issue.severity})`);
      console.log(`   Found: ${issue.count} occurrence(s)`);
      console.log(`   Issue: ${issue.description}`);
      console.log(`   Fix: ${issue.recommendation}`);
      
      if (issue.matches && issue.matches.length > 0) {
        console.log(`   Examples:`);
        issue.matches.forEach((match, idx) => {
          const truncated = match.length > 80 ? match.substring(0, 77) + '...' : match;
          console.log(`     ${idx + 1}. ${truncated}`);
        });
      }
    });
    
    console.log('\n');
  });
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Total potential quota issues found: ${totalIssues}`);
  console.log(`   🔴 HIGH severity: ${severityCounts.HIGH}`);
  console.log(`   🟡 MEDIUM severity: ${severityCounts.MEDIUM}`);
  console.log(`   🟢 LOW severity: ${severityCounts.LOW}`);
  console.log('');
  
  console.log('🎯 Top Recommendations:\n');
  console.log('1. Add pagination (.limit() and .startAfter()) to all collection queries');
  console.log('2. Implement caching for dashboard and statistics queries');
  console.log('3. Use Firestore indexes for frequently queried fields');
  console.log('4. Move filtering logic from application code to Firestore queries');
  console.log('5. Batch document reads using db.getAll() instead of sequential reads');
  console.log('6. Consider using Cloud Functions for heavy aggregations');
  console.log('7. Implement query result caching with TTL (Time To Live)');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run analysis
console.log('🔍 Scanning codebase for Firebase quota usage patterns...\n');

const projectRoot = path.resolve(__dirname, '..');
const results = analyzeDirectory(projectRoot);

if (Object.keys(results).length === 0) {
  console.log('✅ No obvious quota usage issues found!');
} else {
  generateReport(results);
}
