import React from 'react';
import { X } from 'lucide-react';

export const PrivacyPolicyModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
    <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 space-y-4 animate-slide-up max-h-[80vh] flex flex-col">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-lg text-gray-800">Informativa sulla Privacy</h2>
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="overflow-y-auto pr-2 text-sm text-gray-600 space-y-4 flex-1">
        <p><strong>1. Titolare del Trattamento (Data Controller)</strong><br/>Il titolare del trattamento dei dati è l'amministratore dell'applicazione "华意记账".</p>
        <p><strong>2. Dati Trattati (Data Processed)</strong><br/>Raccogliamo e trattiamo il tuo numero di telefono per l'autenticazione e i dati relativi alle tue transazioni finanziarie inserite nell'app.</p>
        <p><strong>3. Finalità del Trattamento (Purpose of Processing)</strong><br/>I dati sono utilizzati esclusivamente per fornirti il servizio di tracciamento delle spese, per la gestione del tuo account e per garantire la sicurezza dell'applicazione.</p>
        <p><strong>4. Conservazione dei Dati (Data Retention)</strong><br/>I tuoi dati sono conservati in modo sicuro sui server cloud e mantenuti fino a quando non deciderai di eliminare il tuo account o richiederne la cancellazione.</p>
        <p><strong>5. Diritti dell'Utente (User Rights - GDPR)</strong><br/>Ai sensi del Regolamento (UE) 2016/679 (GDPR), hai il diritto di accedere ai tuoi dati, chiederne la rettifica, la cancellazione (diritto all'oblio) o la limitazione del trattamento. Puoi esercitare questi diritti eliminando i dati direttamente dall'app o contattando l'amministratore.</p>
        <p><strong>6. Consenso (Consent)</strong><br/>Utilizzando questa applicazione e accedendo tramite numero di telefono, acconsenti al trattamento dei tuoi dati personali come descritto in questa informativa.</p>
      </div>
      <button onClick={onClose} className="w-full py-3 mt-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
        Ho capito / 我已了解
      </button>
    </div>
  </div>
);
