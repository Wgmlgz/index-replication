'use client';

import { useEffect } from 'react';
import { consumeKeycloakSilentCallback } from '@/lib/keycloak-auth';

export default function KeycloakSilentCallbackPage() {
  useEffect(() => {
    void consumeKeycloakSilentCallback();
  }, []);

  return null;
}
