// src/app/admin/logs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  ButtonGroup,
  IndexTable,
  Text,
  Pagination,
  Banner,
  Spinner,
  Badge,
} from '@shopify/polaris';

interface Log {
  id: string;
  customerId: string;
  type: 'add' | 'use';
  points: number;
  orderId?: string;
  reason?: string;
  timestamp: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  // フィルタ
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 一括付与
  const [bulkCustomerId, setBulkCustomerId] = useState('');
  const [bulkPoints, setBulkPoints] = useState<string>('0');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // ページネーション
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const addLogsCount = logs.filter((log) => log.type === 'add').length;
  const useLogsCount = logs.filter((log) => log.type === 'use').length;
  const addPointsTotal = logs
    .filter((log) => log.type === 'add')
    .reduce((sum, log) => sum + Number(log.points || 0), 0);
  const usePointsTotal = logs
    .filter((log) => log.type === 'use')
    .reduce((sum, log) => sum + Number(log.points || 0), 0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);
      if (type) params.append('type', type);
      if (reason) params.append('reason', reason);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setPage(0);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // CSV エクスポート
  const exportCSV = () => {
    if (logs.length === 0) return;
    const header = ['id','customerId','type','points','orderId','reason','timestamp'];

  const rows = logs.map((log) => [
      log.id,
      log.customerId,
      log.type,
      log.points,
      log.orderId || '',
      formatLogReason(log.reason),
      new Date(log.timestamp).toISOString(),
    ]);
    const csvContent = '\uFEFF' + [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'point_logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON エクスポート
  const exportJSON = () => {
    if (logs.length === 0) return;
    const jsonContent = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'point_logs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatLogReason = (reason?: string) => {
    switch (reason) {
      case 'purchase':
        return '購入付与';
      case 'point_use':
        return 'ポイント利用';
      case 'admin_edit':
        return '管理画面操作';
      case 'bulk_add':
        return '一括付与';
      case 'campaign':
        return 'キャンペーン';
      default:
        return reason || '-';
    }
  };

  // 一括付与処理
  const handleBulkAdd = async () => {
    if (!bulkPoints || Number(bulkPoints) <= 0) {
      alert('付与ポイント数を入力してください');
      return;
    }
    setBulkLoading(true);
    try {
      const res = await fetch('/api/points/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: bulkCustomerId.trim() || null,
          points: Number(bulkPoints),
          reason: bulkReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('ポイント付与が完了しました');
        setBulkCustomerId('');
        setBulkPoints('0');
        setBulkReason('');
        fetchLogs();
      } else {
        alert('エラー: ' + (data.error || '不明なエラー'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBulkLoading(false);
    }
  };

  // DataTable 表示データ
  const rows = logs
    .slice(page * pageSize, (page + 1) * pageSize)
    .map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.customerId,
      log.type === 'add' ? '付与' : '利用',
      log.points,
      log.orderId || '-',
      log.reason === 'admin_edit'
        ? '管理画面操作'
        : log.reason || '-',
    ]);

  return (
    <Page title="ポイント履歴管理">
      <Layout>
        {/* フィルタ */}
        <Layout.Section>
          <Card sectioned>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "2fr 1fr 1fr 1fr 1fr auto",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <TextField
                label="顧客ID"
                value={customerId}
                onChange={(v) => setCustomerId(v)}
                autoComplete="off"
              />

              <Select
                label="タイプ"
                options={[
                  { label: 'すべて', value: '' },
                  { label: '付与', value: 'add' },
                  { label: '利用', value: 'use' },
                ]}
                value={type}
                onChange={(v) => setType(v)}
              />

              <Select
                label="理由"
                options={[
                  { label: 'すべて', value: '' },
                  { label: '購入付与', value: 'purchase' },
                  { label: 'ポイント利用', value: 'point_use' },
                  { label: '管理画面操作', value: 'admin_edit' },
                  { label: '一括付与', value: 'bulk_add' },
                  { label: 'キャンペーン', value: 'campaign' },
                ]}
                value={reason}
                onChange={(v) => setReason(v)}
              />

              <TextField
                label="開始日"
                type="date"
                value={startDate}
                onChange={(v) => setStartDate(v)}
                autoComplete="off"
              />

              <TextField
                label="終了日"
                type="date"
                value={endDate}
                onChange={(v) => setEndDate(v)}
                autoComplete="off"
              />

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  paddingBottom: "2px",
                }}
              >
                <Button
                  onClick={fetchLogs}
                  variant="primary"
                >
                  検索
                </Button>

                <Button onClick={exportCSV}>
                  CSV
                </Button>

                <Button onClick={exportJSON}>
                  JSON
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* 集計カード */}
        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <Card sectioned>
              <Text as="p" tone="subdued">
                表示中の履歴
              </Text>
              <Text as="p" variant="headingLg">
                {logs.length} 件
              </Text>
            </Card>

            <Card sectioned>
              <Text as="p" tone="subdued">
                付与履歴
              </Text>
              <Text as="p" variant="headingLg">
                {addLogsCount} 件
              </Text>
              <Text as="p" tone="subdued">
                +{addPointsTotal} pt
              </Text>
            </Card>

            <Card sectioned>
              <Text as="p" tone="subdued">
                利用履歴
              </Text>
              <Text as="p" variant="headingLg">
                {useLogsCount} 件
              </Text>
              <Text as="p" tone="subdued">
                -{usePointsTotal} pt
              </Text>
            </Card>

            <Card sectioned>
              <Text as="p" tone="subdued">
                差引
              </Text>
              <Text as="p" variant="headingLg">
                {addPointsTotal - usePointsTotal} pt
              </Text>
            </Card>
          </div>
        </Layout.Section>

        {/* ログ一覧 */}
        <Layout.Section>
          <Card title="ログ一覧" sectioned>
            {loading ? (
              <div
                style={{
                  padding: "40px",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Spinner
                  accessibilityLabel="Loading logs"
                  size="large"
                />
              </div>
            ) : (
              <>
                <IndexTable
                  resourceName={{
                    singular: 'log',
                    plural: 'logs',
                  }}
                  itemCount={logs.length}
                  selectable={false}
                  headings={[
                    { title: '日時' },
                    { title: '顧客ID' },
                    { title: 'タイプ' },
                    { title: 'ポイント' },
                    { title: '注文ID' },
                    { title: '理由' },
                  ]}
                >
                  {logs
                    .slice(page * pageSize, (page + 1) * pageSize)
                    .map((log, index) => (
                      <IndexTable.Row
                        id={log.id}
                        key={log.id}
                        position={index}
                      >
                        <IndexTable.Cell>
                          <Text
                            as="span"
                            variant="bodyMd"
                          >
                            {new Date(
                              log.timestamp
                            ).toLocaleString()}
                          </Text>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          {log.customerId}
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '999px',
                                background:
                                  log.type === 'add'
                                    ? '#86efac'
                                    : '#f9a8d4',
                              }}
                            />

                            <Text
                              as="span"
                              variant="bodyMd"
                            >
                              {log.type === 'add'
                                ? '付与'
                                : '利用'}
                            </Text>
                          </div>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Badge
                            tone={
                              log.type === 'add'
                                ? 'success'
                                : 'attention'
                            }
                          >
                            {log.type === 'use' ? '-' : '+'}
                            {log.points} pt
                          </Badge>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          {log.orderId || '-'}
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          {log.reason ? (
                            <Badge>
                              {formatLogReason(log.reason)}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                </IndexTable>

                <Pagination
                  hasPrevious={page > 0}
                  onPrevious={() =>
                    setPage((p) => Math.max(0, p - 1))
                  }

                  hasNext={(page + 1) * pageSize < logs.length}

                  onNext={() =>
                    setPage((p) =>
                      (p + 1) * pageSize < logs.length
                        ? p + 1
                        : p
                    )
                  }
                />
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
