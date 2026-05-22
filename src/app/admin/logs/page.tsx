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
  const [searchText, setSearchText] = useState('');
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
  const [pageSize, setPageSize] = useState('20');
  const pageSizeNumber = Number(pageSize);
  const pageStart = logs.length === 0 ? 0 : page * pageSizeNumber + 1;
  const pageEnd = logs.length === 0
    ? 0
    : Math.min((page + 1) * pageSizeNumber, logs.length);

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
      if (searchText) params.append('search', searchText);
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

  const resetFilters = async () => {
    setSearchText('');
    setType('');
    setReason('');
    setStartDate('');
    setEndDate('');
    setPage(0);
    setLoading(true);

    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error resetting logs:', error);
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
    .slice(page * pageSizeNumber, (page + 1) * pageSizeNumber)
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
    <Page
      title="ポイント履歴管理"
      fullWidth
      secondaryActions={[
        {
          content: "CSV",
          onAction: exportCSV,
        },
        {
          content: "JSON",
          onAction: exportJSON,
        },
      ]}
    >
      <Layout>
        {/* フィルタ */}
        <Layout.Section>
          <Card sectioned>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <div style={{ flex: "1 1 280px", minWidth: "240px" }}>
                <TextField
                  label="検索"
                  placeholder="顧客ID・注文ID・ログIDで検索"
                  value={searchText}
                  onChange={(value) => setSearchText(value)}
                  autoComplete="off"
                />
              </div>

              <div style={{ flex: "0 1 150px", minWidth: "130px" }}>
                <Select
                  label="タイプ"
                  options={[
                    { label: 'すべて', value: '' },
                    { label: '付与', value: 'add' },
                    { label: '利用', value: 'use' },
                  ]}
                  value={type}
                  onChange={(value) => setType(value)}
                />
              </div>

              <div style={{ flex: "0 1 170px", minWidth: "140px" }}>
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
                  onChange={(value) => setReason(value)}
                />
              </div>

              <div
                style={{
                  flex: "0 1 160px",
                  minWidth: "145px",
                }}
              >
                <TextField
                  label="開始日"
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChange={(value) => setStartDate(value)}
                  autoComplete="off"
                />
              </div>

              <div
                style={{
                  flex: "0 1 160px",
                  minWidth: "145px",
                }}
              >
                <TextField
                  label="終了日"
                  placeholder="YYYY-MM-DD"
                  value={endDate}
                  onChange={(value) => setEndDate(value)}
                  autoComplete="off"
                />
              </div>

              <div
                style={{
                  flex: "0 0 auto",
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-end",
                  whiteSpace: "nowrap",
                }}
              >
                <button
                  type="button"
                  onClick={fetchLogs}
                  style={{
                    height: "34px",
                    padding: "0 14px",
                    borderRadius: "8px",
                    border: "1px solid #303030",
                    background: "#303030",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: "34px",
                    cursor: "pointer",
                  }}
                >
                  検索
                </button>

                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    height: "34px",
                    padding: "0 14px",
                    borderRadius: "8px",
                    border: "1px solid #c9cccf",
                    background: "#fff",
                    color: "#202223",
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: "34px",
                    cursor: "pointer",
                  }}
                >
                  リセット
                </button>
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* 集計カード */}
        <Layout.Section>
          <Card sectioned>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                alignItems: "stretch",
                minHeight: "68px",
              }}
            >
              <div
                style={{
                  padding: "4px 20px 4px 4px",
                  borderRight: "1px solid #e1e3e5",
                }}
              >
                <Text as="p" tone="subdued">
                  表示中の履歴
                </Text>
                <Text as="p" variant="headingMd">
                  {logs.length} 件
                </Text>
              </div>

              <div
                style={{
                  padding: "4px 20px",
                  borderRight: "1px solid #e1e3e5",
                }}
              >
                <Text as="p" tone="subdued">
                  付与履歴
                </Text>
                <Text as="p" variant="headingMd">
                  {addLogsCount} 件
                </Text>
                <Text as="p" tone="subdued">
                  +{addPointsTotal} pt
                </Text>
              </div>

              <div
                style={{
                  padding: "4px 20px",
                  borderRight: "1px solid #e1e3e5",
                }}
              >
                <Text as="p" tone="subdued">
                  利用履歴
                </Text>
                <Text as="p" variant="headingMd">
                  {useLogsCount} 件
                </Text>
                <Text as="p" tone="subdued">
                  -{usePointsTotal} pt
                </Text>
              </div>

              <div
                style={{
                  padding: "4px 4px 4px 20px",
                }}
              >
                <Text as="p" tone="subdued">
                  差引
                </Text>
                <Text as="p" variant="headingMd">
                  {addPointsTotal - usePointsTotal} pt
                </Text>
              </div>
            </div>
          </Card>
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <Text as="p" tone="subdued">
                    {logs.length === 0
                      ? "0件"
                      : `${page * pageSizeNumber + 1}〜${Math.min(
                          (page + 1) * pageSizeNumber,
                          logs.length
                        )}件 / 全${logs.length}件`}
                  </Text>

                  <div style={{ width: "140px" }}>
                    <Select
                      label="表示件数"
                      labelHidden
                      options={[
                        { label: "20件", value: "20" },
                        { label: "50件", value: "50" },
                        { label: "100件", value: "100" },
                      ]}
                      value={pageSize}
                      onChange={(value) => {
                        setPageSize(value);
                        setPage(0);
                      }}
                    />
                  </div>
                </div>

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
                    .slice(page * pageSizeNumber, (page + 1) * pageSizeNumber)
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

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "12px",
                  }}
                >
                  <Pagination
                    hasPrevious={page > 0}
                    onPrevious={() =>
                      setPage((p) => Math.max(0, p - 1))
                    }
                    hasNext={(page + 1) * pageSizeNumber < logs.length}
                    onNext={() =>
                      setPage((p) =>
                        (p + 1) * pageSizeNumber < logs.length
                          ? p + 1
                          : p
                      )
                    }
                  />

                  <Text as="p" tone="subdued">
                    {logs.length === 0
                      ? "0件"
                      : `全${logs.length}件中 ${pageStart}〜${pageEnd}件を表示`}
                  </Text>
                </div>
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
