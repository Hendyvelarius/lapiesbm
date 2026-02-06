import CryptoJS from 'crypto-js';

/**
 * Parse URL to extract authentication token from suffix
 * The token can be appended in multiple formats:
 * - ?auth=token
 * - &auth=token  
 * - /token (as path suffix)
 * - #token (as hash)
 * @param {string} url - The current URL (optional, defaults to window.location.href)
 * @returns {string|null} - The auth token if found, null otherwise
 */
export const getAuthTokenFromURL = (url = window.location.href) => {
  try {
    // Method 1: Check for ?auth= or &auth= query parameter
    const urlObj = new URL(url);
    const authFromQuery = urlObj.searchParams.get('auth');
    if (authFromQuery) {
      return authFromQuery;
    }
    
    // Method 2: Check for hash fragment (#token)
    if (urlObj.hash && urlObj.hash.length > 1) {
      const hashToken = urlObj.hash.substring(1); // Remove the # symbol
      // Check if it looks like a JWT (has 2 dots for 3 parts)
      if (hashToken.split('.').length === 3) {
        return hashToken;
      }
    }
    
    // Method 3: Check for path suffix (last segment after final /)
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      // Check if it looks like a JWT (has 2 dots for 3 parts)
      if (lastSegment.split('.').length === 3) {
        return lastSegment;
      }
    }
    
    // Method 4: Check entire URL for JWT pattern (fallback)
    const jwtRegex = /eyJ[A-Za-z0-9+/]*\.eyJ[A-Za-z0-9+/]*\.[A-Za-z0-9+/\-_]*/;
    const jwtMatch = url.match(jwtRegex);
    if (jwtMatch) {
      return jwtMatch[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing URL for auth token:', error);
    return null;
  }
};

/**
 * Decode JWT token without verification (client-side only for display purposes)
 * @param {string} token - The JWT token
 * @returns {object|null} - Decoded payload or null if invalid
 */
export const decodeJWT = (token) => {
  try {
    if (!token) {
      return null;
    }

    // JWT has 3 parts: header.payload.signature
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (middle part)
    const payload = parts[1];
    
    // Add padding if needed for base64 decoding
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    
    // Decode base64
    const decodedPayload = atob(paddedPayload);
    
    // Parse JSON
    const parsedPayload = JSON.parse(decodedPayload);
    
    return parsedPayload;
    
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return null;
  }
};

/**
 * Extract user information from decoded JWT payload
 * @param {object} payload - The decoded JWT payload
 * @returns {object|null} - User information or null if invalid
 */
export const extractUserInfo = (payload) => {
  try {
    if (!payload) {
      return null;
    }

    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    // Extract user information from payload
    const userInfo = {
      // Basic user data
      logNIK: payload.user?.log_NIK || 'Unknown',
      nama: payload.user?.Nama || 'Unknown User',
      jabatan: payload.user?.Jabatan || 'Unknown Position',
      jobLevelID: payload.user?.Job_LevelID || 'Unknown',
      pkID: payload.user?.Pk_ID || 'Unknown',
      inisialNama: payload.user?.Inisial_Name || 'Unknown',
      empDeptID: payload.user?.emp_DeptID || 'Unknown',
      empJobLevelID: payload.user?.emp_JobLevelID || 'Unknown',
      
      // Token metadata
      issuedAt: payload.iat ? new Date(payload.iat * 1000).toLocaleString() : 'Unknown',
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'Unknown',
      tokenValid: payload.exp ? payload.exp > Date.now() / 1000 : false,
      
      // Full payload for debugging
      fullPayload: payload
    };

    return userInfo;
    
  } catch (error) {
    console.error('Error extracting user info from payload:', error);
    return null;
  }
};

/**
 * Check if user has department access based on department and job level rules
 * @param {object} userInfo - User information object
 * @returns {object} - Access result with allowed status, access level, and message
 */
const checkDepartmentAccess = (userInfo) => {
  const empDeptID = userInfo.empDeptID;
  const empJobLevelID = userInfo.empJobLevelID;
  const inisialNama = userInfo.inisialNama;
  
  // NT department - only specific users (HWA, GWN, DNY) have full access
  // All other NT users are denied completely
  const NT_ALLOWED_INITIALS = ['HWA', 'GWN', 'DNY'];
  if (empDeptID === 'NT') {
    if (NT_ALLOWED_INITIALS.includes(inisialNama)) {
      return {
        allowed: true,
        accessLevel: 'full',
        message: 'Full access granted',
        reason: null
      };
    } else {
      return {
        allowed: false,
        accessLevel: null,
        message: `Access denied. NT department access is restricted to authorized personnel only. Your initials: ${inisialNama || 'Unknown'}. Please contact your administrator if you believe this is an error.`,
        reason: 'nt_user_restriction'
      };
    }
  }
  
  // PL has full access regardless of job level
  if (empDeptID === 'PL') {
    return {
      allowed: true,
      accessLevel: 'full',
      message: 'Full access granted',
      reason: null
    };
  }
  
  // RD2 MGR gets full access (same as PL)
  if (empDeptID === 'RD2' && empJobLevelID === 'MGR') {
    return {
      allowed: true,
      accessLevel: 'full',
      message: 'Full access granted for RD2 manager',
      reason: null
    };
  }
  
  // RD1, RD3 managers get limited access (Home + HPP Simulation only)
  if (['RD1', 'RD3'].includes(empDeptID)) {
    if (empJobLevelID === 'MGR') {
      return {
        allowed: true,
        accessLevel: 'limited',
        message: 'Limited access granted for manager level (Home and HPP Simulation)',
        reason: null
      };
    } else {
      return {
        allowed: false,
        accessLevel: null,
        message: `Access denied. RD1 and RD3 department staff require Manager level access. Your department: ${empDeptID}, Job Level: ${empJobLevelID || 'Unknown'}. Please contact your administrator if you believe this is an error.`,
        reason: 'job_level_restriction'
      };
    }
  }
  
  // RD2 non-managers are denied
  if (empDeptID === 'RD2' && empJobLevelID !== 'MGR') {
    return {
      allowed: false,
      accessLevel: null,
      message: `Access denied. RD2 department staff require Manager level access. Your department: ${empDeptID}, Job Level: ${empJobLevelID || 'Unknown'}. Please contact your administrator if you believe this is an error.`,
      reason: 'job_level_restriction'
    };
  }
  
  // HD department with HO job level gets limited access (Home + HPP Simulation only)
  if (empDeptID === 'HD' && empJobLevelID === 'HO') {
    return {
      allowed: true,
      accessLevel: 'limited',
      message: 'Limited access granted (Home and HPP Simulation)',
      reason: null
    };
  }
  
  // All other departments are denied
  return {
    allowed: false,
    accessLevel: null,
    message: `Access denied. This application is restricted to authorized PL department staff, RD1/RD2/RD3 managers, and HD HO only. Your department: ${empDeptID || 'Unknown'}, Job Level: ${empJobLevelID || 'Unknown'}. Please contact your administrator if you believe this is an error.`,
    reason: 'department_restriction'
  };
};

/**
 * Complete authentication flow - extract token from URL and decode user info
 * @param {string} url - The current URL (optional)
 * @returns {object} - Authentication result with user info and status
 */
export const authenticateFromURL = (url) => {
  try {
    // Step 1: Get token from URL
    const authToken = getAuthTokenFromURL(url);
    
    if (!authToken) {
      return {
        success: false,
        message: 'No authentication token found in URL',
        user: null,
        token: null
      };
    }

    // Step 2: Decode JWT
    const decodedPayload = decodeJWT(authToken);
    
    if (!decodedPayload) {
      return {
        success: false,
        message: 'Failed to decode authentication token',
        user: null,
        token: authToken
      };
    }

    // Step 3: Extract user info
    const userInfo = extractUserInfo(decodedPayload);
    
    if (!userInfo) {
      return {
        success: false,
        message: 'Failed to extract user information from token',
        user: null,
        token: authToken
      };
    }

    // Step 4: Check if token is still valid
    if (!userInfo.tokenValid) {
      const expiredHours = Math.round((Date.now() / 1000 - userInfo.fullPayload.exp) / 3600);
      return {
        success: false,
        message: `Authentication token expired ${expiredHours} hours ago (${userInfo.expiresAt}). Please get a fresh token from the main system.`,
        user: userInfo,
        token: authToken,
        expiredHours
      };
    }

    // Step 5: Check if user has required department access
    const hasAccess = checkDepartmentAccess(userInfo);
    if (!hasAccess.allowed) {
      return {
        success: false,
        message: hasAccess.message,
        user: userInfo,
        token: authToken,
        accessLevel: null,
        unauthorizedReason: hasAccess.reason
      };
    }
    
    return {
      success: true,
      message: 'Authentication successful',
      user: userInfo,
      token: authToken,
      accessLevel: hasAccess.accessLevel
    };
    
  } catch (error) {
    console.error('Error in authentication flow:', error);
    return {
      success: false,
      message: `Authentication error: ${error.message}`,
      user: null,
      token: null
    };
  }
};

/**
 * Store authentication data in localStorage
 * @param {object} authData - Authentication data to store
 */
export const storeAuthData = (authData) => {
  try {
    localStorage.setItem('eSBM_auth', JSON.stringify(authData));
  } catch (error) {
    console.error('Error storing auth data:', error);
  }
};

/**
 * Retrieve authentication data from localStorage
 * @returns {object|null} - Stored authentication data or null
 */
export const getStoredAuthData = () => {
  try {
    const storedData = localStorage.getItem('eSBM_auth');
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      
      // Check if stored token is still valid
      if (parsedData.user && parsedData.user.tokenValid) {
        const currentTime = Date.now() / 1000;
        const expirationTime = parsedData.user.fullPayload?.exp;
        
        if (expirationTime && expirationTime < currentTime) {
          clearAuthData();
          return null;
        }
      }
      
      return parsedData;
    }
    return null;
  } catch (error) {
    console.error('Error retrieving stored auth data:', error);
    return null;
  }
};

/**
 * Clear authentication data from localStorage
 */
export const clearAuthData = () => {
  try {
    localStorage.removeItem('eSBM_auth');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};

/**
 * Check if user is currently authenticated
 * @returns {boolean} - True if authenticated, false otherwise
 */
export const isAuthenticated = () => {
  const authData = getStoredAuthData();
  return authData && authData.success && authData.user && authData.user.tokenValid;
};

/**
 * Check if user has required department access
 * @returns {boolean} - True if user has access, false otherwise
 */
export const hasDesktopAccess = () => {
  const user = getCurrentUser();
  if (!user) return false;
  
  const accessCheck = checkDepartmentAccess(user);
  return accessCheck.allowed;
};

/**
 * Get current authenticated user info
 * @returns {object|null} - Current user info or null if not authenticated
 */
export const getCurrentUser = () => {
  const authData = getStoredAuthData();
  return authData && authData.success ? authData.user : null;
};

/**
 * Get current user's access level
 * @returns {string|null} - 'full', 'limited', or null if not authenticated
 */
export const getAccessLevel = () => {
  const authData = getStoredAuthData();
  return authData && authData.success ? authData.accessLevel : null;
};

/**
 * Check if user has full access
 * @returns {boolean} - True if user has full access, false otherwise
 */
export const hasFullAccess = () => {
  return getAccessLevel() === 'full';
};

/**
 * Check if user has limited access (simulation only)
 * @returns {boolean} - True if user has limited access, false otherwise
 */
export const hasLimitedAccess = () => {
  return getAccessLevel() === 'limited';
};

/**
 * Clean authentication token from current URL
 * Removes token from query parameters, hash, or path
 */
export const cleanAuthFromURL = () => {
  try {
    const url = new URL(window.location);
    let cleaned = false;
    
    // Remove auth query parameter
    if (url.searchParams.has('auth')) {
      url.searchParams.delete('auth');
      cleaned = true;
    }
    
    // Remove hash if it looks like a JWT
    if (url.hash && url.hash.length > 1) {
      const hashToken = url.hash.substring(1);
      if (hashToken.split('.').length === 3) {
        url.hash = '';
        cleaned = true;
      }
    }
    
    // Remove JWT from path if it's the last segment
    const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment.split('.').length === 3) {
        pathSegments.pop();
        url.pathname = '/' + pathSegments.join('/');
        cleaned = true;
      }
    }
    
    if (cleaned) {
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }
    
  } catch (error) {
    console.error('Error cleaning auth from URL:', error);
  }
};

/**
 * Logout user by clearing authentication data
 */
export const logout = () => {
  clearAuthData();
  // Optionally redirect to login page or refresh
  // window.location.href = '/login';
};

