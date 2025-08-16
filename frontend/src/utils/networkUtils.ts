// 네트워크 관련 유틸리티 함수들

export const getNetworkInfo = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol;
  
  return {
    hostname,
    port,
    protocol,
    isLocalhost: hostname === 'localhost' || hostname === '127.0.0.1',
    fullHost: `${protocol}//${hostname}${port ? `:${port}` : ''}`
  };
};

export const generateNetworkLink = (path: string = '') => {
  const networkIP = process.env.REACT_APP_NETWORK_IP || '192.168.26.92';
  const port = window.location.port;
  const protocol = window.location.protocol;
  
  return `${protocol}//${networkIP}${port ? `:${port}` : ''}${path}`;
};

export const getShareableLink = (includeNetworkOption: boolean = true) => {
  const currentUrl = window.location.href;
  const { isLocalhost } = getNetworkInfo();
  
  if (!isLocalhost || !includeNetworkOption) {
    return {
      local: currentUrl,
      network: currentUrl,
      isNetworkAvailable: !isLocalhost
    };
  }
  
  const networkLink = generateNetworkLink(window.location.pathname + window.location.search);
  
  return {
    local: currentUrl,
    network: networkLink,
    isNetworkAvailable: true
  };
};