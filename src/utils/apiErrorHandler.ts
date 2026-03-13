// utils/apiErrorHandler.ts

export const handleApiError = (error: any): string => {
  if (error.response) {
    // If the error response contains data (server-side issue)
    return (
      error.response.data.message || "An error occurred while fetching data."
    );
  } else if (error.request) {
    // No response received (e.g., network issue)
    return "Network error. Please check your connection.";
  } else {
    // Any other errors
    return error.message || "An unexpected error occurred.";
  }
};
