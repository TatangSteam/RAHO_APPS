type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
      error?: {
        message?: string;
      };
    };
  };
};

export function getShipmentApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return fallback;
  }

  const response = (error as ApiErrorLike).response;
  return response?.data?.error?.message || response?.data?.message || fallback;
}
