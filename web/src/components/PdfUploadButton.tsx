import React from 'react';

interface PdfUploadButtonProps {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  className?: string;
}

export const PdfUploadButton: React.FC<PdfUploadButtonProps> = ({ 
  onChange, 
  label = 'Upload PDF',
  className = 'pdf-upload-button'
}) => {
  return (
    <>
      <label htmlFor="pdf-upload" className={className}>
        {label}
      </label>
      <input
        id="pdf-upload"
        type="file"
        accept=".pdf"
        onChange={onChange}
        style={{ display: 'none' }}
      />
    </>
  );
};
