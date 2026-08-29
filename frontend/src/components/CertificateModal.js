import React from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Trophy, Printer } from 'lucide-react';

export const CertificateModal = ({ certificate, onClose }) => {
  if (!certificate) return null;

  const awarded = new Date(certificate.awarded_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Dialog open={!!certificate} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[780px] p-0 overflow-hidden" data-testid="certificate-modal">
        <div className="certificate-print bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-3">
          <div className="border-4 border-double border-amber-600 rounded-lg p-8 sm:p-10 text-center bg-white/70">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg">
                <Trophy className="w-8 h-8 text-white" />
              </div>
            </div>
            <p className="uppercase tracking-[0.3em] text-xs text-amber-700 font-semibold mb-1">STEAM Hub</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
              Certificate of Achievement
            </h2>
            {certificate.is_professional && (
              <Badge className="bg-sky-100 text-sky-800 mb-4">⭐ Professional Contest</Badge>
            )}
            <p className="text-gray-500 text-sm mt-3">This certifies that</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700 my-2" style={{ fontFamily: 'Georgia, serif' }} data-testid="certificate-student-name">
              {certificate.student_name}
            </p>
            <p className="text-gray-600 text-sm max-w-md mx-auto">
              finished in <span className="font-bold text-amber-700">1st place</span> in the contest
            </p>
            <p className="text-xl font-semibold text-gray-900 mt-1" data-testid="certificate-contest-title">
              “{certificate.tournament_title}”
            </p>
            <p className="text-gray-500 text-sm mt-1">Subject: {certificate.subject}</p>

            <div className="flex items-end justify-between mt-10 px-4 sm:px-10 text-left">
              <div>
                <p className="text-sm font-semibold text-gray-800 border-t border-gray-400 pt-1">{certificate.teacher_name}</p>
                <p className="text-xs text-gray-500">Host Educator</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-800 border-t border-gray-400 pt-1">{awarded}</p>
                <p className="text-xs text-gray-500">Date Awarded</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-6">Certificate ID: {certificate.id}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 bg-gray-50 print:hidden">
          <Button variant="outline" onClick={onClose} data-testid="certificate-close-btn">Close</Button>
          <Button onClick={() => window.print()} className="bg-amber-600 hover:bg-amber-700" data-testid="certificate-print-btn">
            <Printer className="w-4 h-4 mr-2" /> Print / Save as PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
