import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function Tokens() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate('/app/profile'); }, []);
  return null;
}
