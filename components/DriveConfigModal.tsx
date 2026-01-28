
import React, { useState } from 'react';
import { 
  XIcon, 
  KeyIcon, 
  ShieldCheckIcon, 
  HelpCircleIcon, 
  PlayCircleIcon
} from 'lucide-react';

interface DriveConfigModalProps {
  initialClientId?: string;
  initialApiKey?: string;
  onSave: (clientId: string, apiKey: string) => void;
  onDemo: () => void;
  onClose: () => void;
}

const DriveConfigModal: React.FC<DriveConfigModalProps> = ({ 
  onSave, 
  onDemo, 
  onClose,
  initialClientId = '',
  initialApiKey = ''
}) => {
  const [clientId, setClientId] = useState(initialClientId);
  const [apiKey, setApiKey] = useState(initialApiKey);

  const handleSave = () => {
    if (clientId.trim() && apiKey.trim()) {
      onSave(clientId.trim(), apiKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-indigo-600" />
              Configure Google Drive
            </h3>
            <p className="text-sm text-slate-500 mt-1">Connect your Google Cloud Project.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <p className="text-xs text-indigo-800 leading-relaxed">
              To enable real Drive integration, you must provide a valid <b>Client ID</b> and <b>API Key</b> from your Google Cloud Console. These are not stored on any server.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">OAuth 2.0 Client ID</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. 123456789-abc...apps.googleusercontent.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">API Key</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. AIzaSy..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button 
              onClick={handleSave}
              disabled={!clientId || !apiKey}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
            >
              Save Credentials & Connect
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">OR</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button 
              onClick={onDemo}
              className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <PlayCircleIcon className="w-4 h-4" />
              Use Simulation Mode (Demo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveConfigModal;
