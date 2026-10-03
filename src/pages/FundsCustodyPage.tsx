import { useAccess } from '../contexts/AccessContext';
import React from 'react';
import { FaBalanceScale, FaShieldAlt } from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';
import UnauthorizedClearingWorkspace from '../components/nexus/UnauthorizedClearingWorkspace';
import { useAuth } from '../contexts/AuthContext';
import '../components/nexus/UnauthorizedClearingWorkspace.css';

const FundsCustodyPage: React.FC = () => {
  const { user } = useAuth();
  const { canAccessModule } = useAccess();
  const [searchParams] = useSearchParams();
  const actor = user?.username || user?.email || 'sentinel-operator';
  const userRole = (user?.role || '').toLowerCase();
  const hasCustodyAccess = canAccessModule('funds_custody.workspace') && userRole === 'admin';
  const initialWorkspace = searchParams.get('workspace') === 'execution' ? 'execution' : 'control';

  if (!hasCustodyAccess) {
    return (
      <div className="funds-custody-page">
        <section className="funds-custody-access-denied">
          <span><FaShieldAlt /></span>
          <small>Restricted funds authority</small>
          <h1>Funds Custody is outside your current operating scope.</h1>
          <p>This workspace is reserved for authorized SentinelOps custodians with clearing administration access.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="funds-custody-page">
      <div className="funds-custody-grid" aria-hidden="true" />
      <div className="funds-custody-watermark" aria-hidden="true"><FaBalanceScale /></div>
      <UnauthorizedClearingWorkspace actor={actor} userRole={userRole} initialView={initialWorkspace} />
    </div>
  );
};

export default FundsCustodyPage;
