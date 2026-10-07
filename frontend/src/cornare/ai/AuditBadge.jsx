import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { auditBundle } from './client.js';

export function AuditBadge({ service, bundle }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!service) return undefined;
    let live = true;
    auditBundle(bundle).then((value) => live && setReport(value)).catch((cause) => live && setError(cause.message));
    return () => { live = false; };
  }, [service, bundle]);

  if (!service) {
    return <p className="audit-badge is-off" data-testid="audit-badge">Auditoría disponible con el servicio local</p>;
  }
  if (error) return <p className="audit-badge is-off" data-testid="audit-badge">Auditoría no disponible: {error}</p>;
  if (!report) return <p className="audit-badge" data-testid="audit-badge">Auditando la exportación…</p>;
  return (
    <div className={report.export_allowed ? 'audit-badge' : 'audit-badge is-blocked'} data-testid="audit-badge">
      <p><ShieldCheck size={14} /> {report.critical} hallazgos críticos · {report.verified_claims} afirmaciones verificadas</p>
      {report.findings.length > 0 && (
        <details>
          <summary>Hallazgos</summary>
          <ul>{report.findings.map((finding, index) => <li key={index}>{finding.severity} · {finding.product} · {finding.message}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
