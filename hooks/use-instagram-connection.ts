"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import type { InstagramConnectionSnapshot, ModuleKey } from '@/types';

const EMPTY_STATE: InstagramConnectionSnapshot = {
  ok: true,
  connected: false,
  usingWorkspaceToken: false,
  provider: 'meta-graph',
  message: 'Conecte uma conta do Instagram Business para puxar feed, stories e métricas reais.',
  insights: [],
  media: [],
  stories: []
};

export function useInstagramConnection(workspaceSlug: string, module: ModuleKey) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<InstagramConnectionSnapshot>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const connectUrl = useMemo(() => {
    const params = new URLSearchParams({
      workspace: workspaceSlug,
      module
    });

    return `/api/integrations/meta/connect?${params.toString()}`;
  }, [module, workspaceSlug]);

  const refresh = useCallback(async () => {
    setSyncing(true);

    try {
      const params = new URLSearchParams({
        workspace: workspaceSlug
      });
      const response = await fetch(`/api/integrations/meta?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = (await response.json().catch(() => null)) as InstagramConnectionSnapshot | null;
      if (!payload) {
        throw new Error('Nao foi possivel carregar a integracao do Instagram.');
      }

      setData({
        ...payload,
        connectUrl
      });
    } catch (error) {
      setData({
        ...EMPTY_STATE,
        ok: false,
        message: error instanceof Error ? error.message : 'Falha ao carregar o Instagram.',
        connectUrl
      });
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [connectUrl, workspaceSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const status = searchParams.get('instagram');
    if (!status) return;

    if (status === 'connected') {
      toast.success('Instagram conectado com sucesso.');
      void refresh();
      return;
    }

    if (status === 'cancelled') {
      toast.error('A conexão com o Instagram foi cancelada.');
      return;
    }

    if (status === 'missing-config') {
      toast.error('A configuração base da Meta ainda está incompleta.');
      return;
    }

    if (status === 'missing-business-config') {
      toast.error('O Facebook Login for Business está ativo, mas o META_CONFIG_ID ainda não foi configurado.');
      return;
    }

    if (status === 'invalid-state') {
      toast.error('Nao foi possivel validar a sessao de conexao do Instagram. Tente novamente.');
      return;
    }

    if (status === 'error' || status === 'missing-code') {
      toast.error('Nao foi possivel concluir a conexao com o Instagram.');
    }
  }, [refresh, searchParams]);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);

    try {
      const params = new URLSearchParams({
        workspace: workspaceSlug
      });
      const response = await fetch(`/api/integrations/meta?${params.toString()}`, {
        method: 'DELETE'
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? 'Falha ao desconectar a conta.');
      }

      toast.success(payload.message ?? 'Conta desconectada.');
      setData({
        ...EMPTY_STATE,
        connectUrl
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao desconectar o Instagram.');
    } finally {
      setDisconnecting(false);
    }
  }, [connectUrl, workspaceSlug]);

  return {
    data: {
      ...data,
      connectUrl
    },
    loading,
    syncing,
    disconnecting,
    refresh,
    disconnect
  };
}
