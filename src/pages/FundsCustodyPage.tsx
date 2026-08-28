import React from 'react';
import { FaBalanceScale, FaShieldAlt } from 'react-icons/fa';
import UnauthorizedClearingWorkspace from '../components/nexus/UnauthorizedClearingWorkspace';
import { useAuth } from '../contexts/AuthContext';
import { SECTION_MANUAL_ID } from '../content/sentinelManual';
import '../components/nexus/UnauthorizedClearingWorkspace.css';

const FundsCustodyPage: React.FC = () => {
  const { user } = useAuth();
  const actor = user?.username || user?.email || 'sentinel-operator';
  const userRole = (user?.role || '').toLowerCase();
  const hasCustodyAccess = user?.section_id === SECTION_MANUAL_ID && userRole === 'admin';

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
      <UnauthorizedClearingWorkspace actor={actor} userRole={userRole} />
    </div>
  );
};

export default FundsCustodyPage;
