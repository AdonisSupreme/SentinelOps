// src/pages/NotFoundPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHome } from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="not-found-page">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <button onClick={() => navigate('/')}>
        <FaHome /> Return to Home
      </button>
      <PageGuide guide={pageGuides.notFound} />
    </div>
  );
};

export default NotFoundPage;
