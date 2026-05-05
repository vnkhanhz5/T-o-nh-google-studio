/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { AppState } from '../types';

interface StatusBarProps {
  state: AppState;
  useFixedSelectionBox: boolean;
  isInitialState: boolean;
  onUploadClick: () => void;
}

const getStatusMessage = (state: AppState, useFixedSelectionBox:boolean): string => {
  switch (state) {
    case AppState.IDLE:
      return 'SYSTEM IDLE. AWAITING INPUT.';
    case AppState.LOADING:
      return 'LOADING INITIAL ASSETS... STANDBY...';
    case AppState.LOADED:
      return 'IMAGE LOADED. '+ (useFixedSelectionBox ? 'CLICK TO SELECT AREA TO ENHANCE' : 'DRAW SELECTION TO ENHANCE.');
    case AppState.SELECTING:
        return 'DEFINING SELECTION AREA...';
    case AppState.ENHANCING:
      return 'ANALYZING SELECTION... ENHANCING...';
    case AppState.ENHANCED:
      return 'APPLYING ENHANCEMENT...';
    default:
      return '...';
  }
};

export const StatusBar: React.FC<StatusBarProps> = ({ state, useFixedSelectionBox, isInitialState, onUploadClick }) => {
  // Special UI for the initial loaded state, combining the prompt and status
  if (state === AppState.LOADED && isInitialState) {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-center text-green-400 font-mono tracking-widest text-sm border-t border-green-500/30 z-10 flex items-center justify-center h-12">
        <p className="hidden sm:block animate-pulse">Drag and drop a new image or click on the current one to begin</p>
        <button
          onClick={onUploadClick}
          className="block sm:hidden px-4 py-2 bg-green-500/20 border border-green-500/50 rounded text-green-300 hover:bg-green-500/30 transition-colors"
        >
          Select Image
        </button>
      </div>
    );
  }

  // Fallback to original status bar for all other states
  return (
    <div className="h-8 border-t border-[#303030] bg-[#111111] px-4 flex items-center justify-between text-[#8e8e8e] text-[10px] uppercase tracking-wider font-medium shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${state === AppState.ENHANCING ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
          <span>Status: {message}</span>
        </div>
        <div className="h-3 w-[1px] bg-[#303030]" />
        <span>Mode: {useFixedSelectionBox ? 'Fixed Rect' : 'Manual Select'}</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" fill="currentColor"/></svg>
          <span>Gemini 2.0 Flash</span>
        </div>
        <div className="h-3 w-[1px] bg-[#303030]" />
        <button onClick={onUploadClick} className="hover:text-white transition-colors">Upload Image</button>
      </div>
    </div>
  );
};
