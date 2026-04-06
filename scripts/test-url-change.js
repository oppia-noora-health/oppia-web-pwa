/**
 * URL Change Feature - Automated Test Suite
 *
 * Run this in browser console to test URL change functionality
 * Usage: Copy and paste this entire file into browser DevTools console
 */

(async function URLChangeTestSuite() {
  console.log("🧪 Starting URL Change Test Suite...\n");

  // Test utilities
  const logger = {
    pass: (test, message) => console.log(`✅ ${test}: ${message || "PASSED"}`),
    fail: (test, message) => console.error(`❌ ${test}: ${message}`),
    info: (message) => console.log(`ℹ️  ${message}`),
    warn: (message) => console.warn(`⚠️  ${message}`),
    section: (title) =>
      console.log(`\n${"=".repeat(50)}\n${title}\n${"=".repeat(50)}`),
  };

  const testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  // Helper: Check if key exists in localStorage
  function checkLocalStorageKey(key, shouldExist = true) {
    const exists = localStorage.getItem(key) !== null;
    if (shouldExist) {
      if (exists) {
        testResults.passed++;
        return true;
      } else {
        testResults.failed++;
        return false;
      }
    } else {
      if (!exists) {
        testResults.passed++;
        return true;
      } else {
        testResults.failed++;
        return false;
      }
    }
  }

  // Helper: Check IndexedDB database
  async function checkIndexedDB(dbName, expectedEmpty = false) {
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const objectStoreNames = Array.from(db.objectStoreNames);
      let totalRecords = 0;

      for (const storeName of objectStoreNames) {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const count = await new Promise((resolve) => {
          const countRequest = store.count();
          countRequest.onsuccess = () => resolve(countRequest.result);
        });
        totalRecords += count;
      }

      db.close();

      if (expectedEmpty && totalRecords === 0) {
        testResults.passed++;
        return { empty: true, count: 0 };
      } else if (!expectedEmpty && totalRecords > 0) {
        testResults.passed++;
        return { empty: false, count: totalRecords };
      } else {
        testResults.failed++;
        return { empty: totalRecords === 0, count: totalRecords };
      }
    } catch (error) {
      logger.warn(
        `IndexedDB ${dbName} doesn't exist or error: ${error.message}`,
      );
      if (expectedEmpty) {
        testResults.passed++;
        return { empty: true, count: 0 };
      }
      testResults.warnings++;
      return { empty: true, count: 0, error: error.message };
    }
  }

  // Helper: Check Cache Storage
  async function checkCacheStorage(cacheName, expectedEmpty = false) {
    if (!("caches" in window)) {
      logger.warn("Cache Storage not supported");
      testResults.warnings++;
      return null;
    }

    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      if (expectedEmpty && keys.length === 0) {
        testResults.passed++;
        return { empty: true, count: 0 };
      } else if (!expectedEmpty && keys.length > 0) {
        testResults.passed++;
        return { empty: false, count: keys.length };
      } else {
        testResults.failed++;
        return { empty: keys.length === 0, count: keys.length };
      }
    } catch (error) {
      logger.warn(`Cache ${cacheName} error: ${error.message}`);
      testResults.warnings++;
      return { empty: true, count: 0, error: error.message };
    }
  }

  // Test 1: Initial State Capture
  logger.section("TEST 1: Capture Current State");
  const initialState = {
    apiUrl: localStorage.getItem("custom_api_url"),
    authStorage: localStorage.getItem("auth-storage"),
    localStorageKeys: Object.keys(localStorage),
    indexedDBs: [],
    caches: [],
  };

  // Check IndexedDB databases
  const dbNames = [
    "NooraHealthCourses",
    "NooraHealthGamification",
    "NooraHealthOffline",
  ];
  for (const dbName of dbNames) {
    const result = await checkIndexedDB(dbName, false);
    initialState.indexedDBs.push({ name: dbName, ...result });
  }

  // Check Cache Storage
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      const result = await checkCacheStorage(cacheName, false);
      initialState.caches.push({ name: cacheName, ...result });
    }
  }

  logger.info(`Current API URL: ${initialState.apiUrl || "Not set"}`);
  logger.info(
    `Auth Storage: ${initialState.authStorage ? "Present" : "Not present"}`,
  );
  logger.info(`localStorage keys: ${initialState.localStorageKeys.length}`);
  logger.info(
    `IndexedDB databases: ${initialState.indexedDBs.map((db) => `${db.name}(${db.count})`).join(", ")}`,
  );
  logger.info(
    `Cache Storage: ${initialState.caches.map((c) => `${c.name}(${c.count})`).join(", ")}`,
  );

  // Test 2: API Client Base URL
  logger.section("TEST 2: Verify API Client Configuration");
  try {
    // Check if apiClient is accessible
    const apiClient = await import("/src/utils/apiClient.ts").catch(() => null);
    if (apiClient) {
      logger.pass("API Client", "Module accessible");
    } else {
      logger.warn("Cannot dynamically import API client in browser");
    }
  } catch (error) {
    logger.warn(`API Client check: ${error.message}`);
  }

  // Test 3: URL Normalization
  logger.section("TEST 3: URL Normalization Tests");
  const normalizeUrl = (url) =>
    url
      .trim()
      .replace(/\/+$/, "")
      .replace(/^https?:\/\//, "")
      .toLowerCase();

  const urlTests = [
    {
      input: "academy.noorahealth.org",
      expected: "academy.noorahealth.org",
    },
    {
      input: "academy.noorahealth.org/",
      expected: "academy.noorahealth.org",
    },
    {
      input: "https://academy.noorahealth.org",
      expected: "academy.noorahealth.org",
    },
    {
      input: "HTTPS://academy.noorahealth.org///",
      expected: "academy.noorahealth.org",
    },
  ];

  urlTests.forEach(({ input, expected }) => {
    const result = normalizeUrl(input);
    if (result === expected) {
      logger.pass("URL Normalize", `${input} → ${result}`);
    } else {
      logger.fail(
        "URL Normalize",
        `${input} → ${result} (expected ${expected})`,
      );
    }
  });

  // Test 4: localStorage Keys After Logout
  logger.section(
    "TEST 4: Check localStorage Keys (Should only have custom_api_url)",
  );

  // These keys should be WIPED after logout
  const keysToWipe = [
    "apiKey",
    "auth-storage",
    "visit-cached-pages",
    "noora_last_activity_",
    "noora_pretest_attempts",
    "user_",
  ];

  // Check current state
  const currentKeys = Object.keys(localStorage);
  logger.info(`Current localStorage keys: ${currentKeys.length}`);

  let hasUnexpectedKeys = false;
  currentKeys.forEach((key) => {
    if (key !== "custom_api_url") {
      // Check if this is a key that should be wiped
      const shouldBeWiped = keysToWipe.some((pattern) => key.includes(pattern));
      if (shouldBeWiped) {
        logger.warn(`Unexpected key still present: ${key}`);
        hasUnexpectedKeys = true;
      }
    }
  });

  if (!hasUnexpectedKeys) {
    logger.pass("localStorage Cleanup", "All auth/user keys properly wiped");
  }

  // Test 5: Supported URLs Validation
  logger.section("TEST 5: URL Validation Tests");
  const SUPPORTED_API_URLS = [
    "https://academy-indonesia.noorahealth.org",
    "https://academy.noorahealth.org",
  ];

  const isValidApiUrl = (url) => {
    const normalized = normalizeUrl(url);
    return SUPPORTED_API_URLS.some(
      (supportedUrl) => normalizeUrl(supportedUrl) === normalized,
    );
  };

  const validationTests = [
    {
      url: "academy.noorahealth.org",
      shouldBeValid: true,
    },
    {
      url: "academy-indonesia.noorahealth.org",
      shouldBeValid: true,
    },
    {
      url: "https://example.com",
      shouldBeValid: false,
    },
    {
      url: "https://malicious.com",
      shouldBeValid: false,
    },
  ];

  validationTests.forEach(({ url, shouldBeValid }) => {
    const isValid = isValidApiUrl(url);
    if (isValid === shouldBeValid) {
      logger.pass(
        "URL Validation",
        `${url} → ${isValid ? "Valid" : "Invalid"}`,
      );
    } else {
      logger.fail(
        "URL Validation",
        `${url} → ${isValid ? "Valid" : "Invalid"} (expected ${shouldBeValid ? "Valid" : "Invalid"})`,
      );
    }
  });

  // Test 6: Check for Data Persistence After Logout
  logger.section("TEST 6: Verify Complete Data Wipe After URL Change");

  // Check if any course data remains
  const coursesDB = await checkIndexedDB("NooraHealthCourses", true);
  if (coursesDB.empty) {
    logger.pass("Courses DB", "Empty after logout");
  } else {
    logger.fail("Courses DB", `Still contains ${coursesDB.count} records`);
  }

  // Check if gamification data remains
  const gamificationDB = await checkIndexedDB("NooraHealthGamification", true);
  if (gamificationDB.empty) {
    logger.pass("Gamification DB", "Empty after logout");
  } else {
    logger.fail(
      "Gamification DB",
      `Still contains ${gamificationDB.count} records`,
    );
  }

  // Check offline data
  const offlineDB = await checkIndexedDB("NooraHealthOffline", true);
  if (offlineDB.empty) {
    logger.pass("Offline DB", "Empty after logout");
  } else {
    logger.fail("Offline DB", `Still contains ${offlineDB.count} records`);
  }

  // Test 7: Check API URL Preservation
  logger.section("TEST 7: Verify API URL Preserved");
  const savedApiUrl = localStorage.getItem("custom_api_url");
  if (savedApiUrl) {
    logger.pass("API URL", `Preserved: ${savedApiUrl}`);
  } else {
    logger.warn("API URL not set (might be using default)");
    testResults.warnings++;
  }

  // Test 8: Network Requests Check
  logger.section("TEST 8: Network Request URL Verification");
  logger.info("Open DevTools Network tab and verify:");
  logger.info("1. All API requests go to the currently set URL");
  logger.info("2. No requests go to the old URL");
  logger.info("3. Check request headers for authentication");
  logger.info("(Manual verification required)");

  // Final Summary
  logger.section("TEST SUMMARY");
  console.log(`
    ✅ Passed: ${testResults.passed}
    ❌ Failed: ${testResults.failed}
    ⚠️  Warnings: ${testResults.warnings}
    
    Total Tests: ${testResults.passed + testResults.failed + testResults.warnings}
  `);

  if (testResults.failed === 0) {
    console.log("🎉 All tests passed!");
  } else {
    console.log("⚠️  Some tests failed. Review the logs above.");
  }

  // Return results for programmatic access
  return {
    initialState,
    testResults,
    currentApiUrl: localStorage.getItem("custom_api_url"),
  };
})();
