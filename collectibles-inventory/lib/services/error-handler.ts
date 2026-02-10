// Error handler for API requests

/**
 * Handles API errors consistently across the application
 * @param error The error object from the API call
 * @returns A rejected promise with a formatted error
 */
export function handleApiError(error: any): never {
  console.error('API Error:', error);
  
  // Check if it's a network error
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    throw new Error('Network error. Please check your connection.');
  }
  
  // Check if it's an authentication error (401)
  if (error.status === 401) {
    // Redirect to login if needed
    // window.location.href = '/auth';
    throw new Error('Authentication required. Please log in again.');
  }
  
  // Handle other specific error codes
  if (error.status === 403) {
    throw new Error('You do not have permission to perform this action.');
  }
  
  if (error.status === 404) {
    throw new Error('The requested resource was not found.');
  }
  
  if (error.status === 500) {
    throw new Error('Server error. Please try again later.');
  }
  
  // Default error message
  throw new Error(error.message || 'An unexpected error occurred.');
}
