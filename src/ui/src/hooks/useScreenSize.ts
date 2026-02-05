import { useState, useEffect } from 'react';

// Hook para detectar o tamanho da tela e se é mobile ou desktop
export function useScreenSize() {
  const [isMobile, setIsMobile] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      
      // Considera mobile se a largura for menor que 1024px (lg do Tailwind)
      setIsMobile(window.innerWidth < 1024);
    };

    // Define o valor inicial
    handleResize();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return { isMobile, windowSize };
}