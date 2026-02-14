#!/usr/bin/env node
/**
 * Environment Feature Comparison Script
 * Compares production (demo.netneural.ai) vs staging (demo-stage.netneural.ai)
 * to identify missing features or broken pages.
 */

import { chromium } from 'playwright';

const PRODUCTION_URL = 'https://demo.netneural.ai';
const STAGING_URL = 'https://demo-stage.netneural.ai';

const TEST_PAGES = [
  '/',
  '/auth/login',
  '/dashboard',
  '/dashboard/devices',
  '/dashboard/alerts',
  '/dashboard/analytics',
  '/dashboard/organizations',
  '/dashboard/settings',
  '/dashboard/users',
  '/dashboard/integrations',
  '/dashboard/alert-rules',
];

async function checkPageAvailability(browser, baseUrl, pages) {
  const results = {};
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  for (const path of pages) {
    const url = `${baseUrl}${path}`;
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
      const status = response?.status() || 0;
      
      // Check for content
      const bodyText = await page.textContent('body').catch(() => '');
      const hasError = bodyText.toLowerCase().includes('error') || 
                       bodyText.toLowerCase().includes('not found') ||
                       bodyText.toLowerCase().includes('404');
      
      results[path] = {
        status,
        accessible: status === 200 || status === 304,
        hasError,
        title: await page.title().catch(() => 'N/A'),
      };
    } catch (error) {
      results[path] = {
        status: 0,
        accessible: false,
        hasError: true,
        error: error.message.substring(0, 100),
      };
    }
  }
  
  await context.close();
  return results;
}

async function compareEnvironments() {
  console.log('🔍 Environment Feature Comparison');
  console.log('=' .repeat(80));
  console.log('');
  
  const browser = await chromium.launch({ headless: true });
  
  console.log('📊 Checking Production:', PRODUCTION_URL);
  const prodResults = await checkPageAvailability(browser, PRODUCTION_URL, TEST_PAGES);
  
  console.log('📊 Checking Staging:', STAGING_URL);
  const stagingResults = await checkPageAvailability(browser, STAGING_URL, TEST_PAGES);
  
  await browser.close();
  
  // Compare results
  console.log('');
  console.log('📋 Comparison Results');
  console.log('=' .repeat(80));
  console.log('');
  
  const missing = [];
  const broken = [];
  const matches = [];
  
  for (const path of TEST_PAGES) {
    const prod = prodResults[path];
    const stage = stagingResults[path];
    
    const status = prod.accessible && stage.accessible ? '✅' :
                   prod.accessible && !stage.accessible ? '❌ MISSING' :
                   !prod.accessible && stage.accessible ? '⚠️  EXTRA' :
                   '🔴 BOTH DOWN';
    
    console.log(`${status} ${path}`);
    console.log(`   Production: ${prod.status} - ${prod.title}`);
    console.log(`   Staging:    ${stage.status} - ${stage.title}`);
    
    if (prod.accessible && !stage.accessible) {
      missing.push({ path, prod, stage });
    } else if (!prod.accessible && !stage.accessible) {
      broken.push({ path, prod, stage });
    } else if (prod.accessible && stage.accessible) {
      matches.push(path);
    }
    
    console.log('');
  }
  
  // Summary
  console.log('');
  console.log('📊 Summary');
  console.log('=' .repeat(80));
  console.log(`✅ Working on both: ${matches.length}`);
  console.log(`❌ Missing in staging: ${missing.length}`);
  console.log(`🔴 Broken on both: ${broken.length}`);
  console.log('');
  
  if (missing.length > 0) {
    console.log('');
    console.log('❌ Features Missing in Staging:');
    console.log('-'.repeat(80));
    for (const item of missing) {
      console.log(`   ${item.path}`);
      console.log(`      Production: ${item.prod.status} (${item.prod.title})`);
      console.log(`      Staging: ${item.stage.status} (${item.stage.error || 'Not accessible'})`);
    }
  }
  
  if (broken.length > 0) {
    console.log('');
    console.log('🔴 Broken on Both Environments:');
    console.log('-'.repeat(80));
    for (const item of broken) {
      console.log(`   ${item.path}`);
    }
  }
  
  return { missing, broken, matches };
}

compareEnvironments().catch(console.error);
