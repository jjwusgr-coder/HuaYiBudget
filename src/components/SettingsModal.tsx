import React, { useState, useCallback } from 'react';
import { formatMoney, compressImage } from '../utils/helpers';
import { doc, setDoc } from 'firebase/firestore';
import { Camera, X, Check } from 'lucide-react';
import Cropper from 'react-easy-crop';

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
  try {
    const image = new Image();
    const promise = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = imageSrc;
    await promise;
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      200,
      200
    );
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (e) {
    console.error('Error in getCroppedImg:', e);
    throw e;
  }
};

export const BarChart = ({ label, data, total, color }: any) => {
  const sorted = Object.entries(data).sort((a: any, b: any) => b[1]-a[1]).slice(0, 5);
  if (sorted.length === 0) return null;
  
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">{label}</div>
      <div className="space-y-2">
        {sorted.map(([k, v]: any) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-12 truncate text-right font-bold text-gray-600">{k}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${color}`} style={{ width: `${(v/total)*100}%` }}/>
            </div>
            <span className="w-16 text-right font-bold font-num text-gray-800">{formatMoney(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SettingsModal = ({ onClose, hasStore, onExport, onImport, onLogout, user, profile, db, appId, showToast }: any) => {
  const [isUploading, setIsUploading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressed = await compressImage(file, 1000);
      setCropImageSrc(compressed);
    } catch (err) {
      console.error("Compression failed", err);
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // reset input
  };

  const handleCropSave = async () => {
    if (!cropImageSrc) return;
    if (!croppedAreaPixels) {
      if (showToast) showToast('请稍候，图片处理中', 'error');
      return;
    }
    if (!user || !db) {
      if (showToast) showToast('用户状态异常', 'error');
      return;
    }
    setIsUploading(true);
    try {
      const croppedBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { 
        avatar: croppedBase64 
      }, { merge: true });
      if (showToast) showToast('头像更新成功', 'success');
      setCropImageSrc(null);
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      if (showToast) showToast('头像上传失败，请尝试其他图片', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const displayAvatar = profile?.avatar || user?.photoURL;

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 space-y-4 animate-slide-up">
          <h2 className="font-bold text-sm text-gray-800">设置</h2>
        
        <div className="space-y-2 pb-4 border-b border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 mb-2">当前账号</h3>
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl mb-3">
            <div className="relative">
              {displayAvatar ? (
                <img src={displayAvatar} referrerPolicy="no-referrer" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" alt="avatar"/>
              ) : (
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center font-bold text-2xl border-2 border-white shadow-sm">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer border border-gray-100 text-gray-500 hover:text-blue-500 transition-colors">
                {isUploading ? <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/> : <Camera size={12} />}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
              </label>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-800 truncate">{user?.displayName || '用户'}</span>
              <span className="text-[10px] text-gray-500 truncate">{user?.email}</span>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex justify-between px-4 py-3 rounded-xl font-bold text-xs bg-red-50 text-red-500 hover:bg-red-100 transition-colors">退出 / 更换账号</button>
        </div>

        <div className="space-y-2 pb-4 border-b border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 mb-2">数据备份</h3>
          <button onClick={() => onExport('json')} disabled={!hasStore} className="w-full flex justify-between px-4 py-3 rounded-xl font-bold text-xs bg-gray-50 disabled:opacity-50">导出 JSON</button>
          <button onClick={() => onExport('csv')} disabled={!hasStore} className="w-full flex justify-between px-4 py-3 rounded-xl font-bold text-xs bg-gray-50 disabled:opacity-50">导出 CSV</button>
        </div>
        <div className="space-y-2 pb-4 border-b border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 mb-2">数据恢复</h3>
          <label className="w-full flex justify-between px-4 py-3 rounded-xl font-bold text-xs bg-gray-50 cursor-pointer">
            导入备份 
            <input type="file" accept=".json,.csv" className="hidden" onChange={onImport} />
          </label>
        </div>
        <button onClick={onClose} className="w-full py-3 text-gray-400 font-bold text-xs">关闭</button>
      </div>
    </div>

    {cropImageSrc && (
      <div className="fixed inset-0 z-[80] bg-black flex flex-col animate-fade-in">
        <div className="flex justify-between items-center p-4 text-white z-10 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={() => setCropImageSrc(null)} className="p-2"><X size={24}/></button>
          <span className="font-bold text-sm">裁剪头像</span>
          <button onClick={handleCropSave} disabled={isUploading} className="p-2 text-blue-400 disabled:opacity-50">
            {isUploading ? <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/> : <Check size={24}/>}
          </button>
        </div>
        <div className="flex-1 relative">
          <Cropper
            image={cropImageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="p-8 pb-12 bg-gradient-to-t from-black/80 to-transparent z-10 flex items-center gap-4">
          <span className="text-white text-xs font-bold">缩放</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
        </div>
      </div>
    )}
    </>
  );
};
