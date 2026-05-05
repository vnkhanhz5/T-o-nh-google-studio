/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';

export const DropZone: React.FC = () => {
  return (
    <div className="w-full flex flex-col items-center justify-center border-2 border-dashed border-[#303030] bg-[#111111] hover:border-blue-500/50 hover:bg-[#151515] rounded-xl text-center p-12 transition-all group">
        <div className="w-16 h-16 bg-[#1e1e1e] rounded-2xl flex items-center justify-center mb-6 border border-[#303030] group-hover:scale-110 transition-transform">
          <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Enhance your images</h2>
        <p className="text-[#8e8e8e] text-sm max-w-[240px] leading-relaxed">
          Drag and drop an image file here to start the enhancement process.
        </p>
        <div className="mt-8 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors cursor-pointer">
          Select from computer
        </div>
    </div>
  );
};
