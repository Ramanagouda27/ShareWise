import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-6 shadow-xs">
        <Compass className="w-8 h-8" />
      </div>
      <span className="text-xs font-mono font-bold tracking-widest uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 mb-3">
        Error 404
      </span>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
        Page Not Found
      </h1>
      <p className="mt-3 text-sm text-neutral-500 max-w-sm">
        The hardware resource or route you were looking for doesn't exist or has been moved.
      </p>
      <div className="mt-8">
        <Link to="/">
          <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};
