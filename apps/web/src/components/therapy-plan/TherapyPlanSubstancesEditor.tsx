'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  calculateIfaSubstanceTotalMl,
  type TherapyPlanSubstance,
} from '@/lib/therapyPlanSubstances';

interface TherapyPlanSubstancesEditorProps {
  value?: TherapyPlanSubstance[] | null;
  onChange: (substances: TherapyPlanSubstance[]) => void;
  disabled?: boolean;
}

export default function TherapyPlanSubstancesEditor({
  value,
  onChange,
  disabled = false,
}: TherapyPlanSubstancesEditorProps) {
  const substances = value || [];
  const totalMl = calculateIfaSubstanceTotalMl(substances);

  const updateSubstance = (
    index: number,
    field: keyof TherapyPlanSubstance,
    fieldValue: string | number
  ) => {
    const next = substances.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return {
        ...item,
        [field]: field === 'amount' ? Number(fieldValue) : fieldValue,
      };
    });
    onChange(next);
  };

  const addSubstance = () => {
    onChange([
      ...substances,
      {
        name: '',
        amount: 0,
        unit: 'ml',
        keterangan: '',
      },
    ]);
  };

  const removeSubstance = (index: number) => {
    onChange(substances.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '16px',
        background: '#071f1d',
        borderRadius: '8px',
        border: '1px solid rgba(20,184,166,0.36)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px 0',
              fontSize: '13px',
              color: '#2dd4bf',
              fontWeight: 700,
            }}
          >
            Zat Tambahan IFA
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
            Catatan database saja. Tidak mengubah infus aktual atau penggunaan material.
          </p>
        </div>

        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: '#0b3430',
            border: '1px solid rgba(20,184,166,0.28)',
            color: '#5eead4',
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          Total: {totalMl} ml
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {substances.length === 0 ? (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px dashed rgba(148,163,184,0.35)',
              background: '#0f1117',
              color: '#94a3b8',
              fontSize: '13px',
            }}
          >
            Belum ada zat tercatat.
          </div>
        ) : (
          substances.map((substance, index) => (
            <div
              key={`${substance.name}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, 1fr) 90px 80px minmax(140px, 1.2fr) 36px',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <input
                className="form-input"
                value={substance.name}
                onChange={(event) => updateSubstance(index, 'name', event.target.value)}
                placeholder="Nama zat"
                disabled={disabled}
                style={{ fontSize: '13px' }}
              />
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                value={substance.amount || ''}
                onChange={(event) => updateSubstance(index, 'amount', event.target.value)}
                placeholder="0"
                disabled={disabled}
                style={{ fontSize: '13px' }}
              />
              <input
                className="form-input"
                value={substance.unit}
                onChange={(event) => updateSubstance(index, 'unit', event.target.value)}
                placeholder="ml"
                disabled={disabled}
                style={{ fontSize: '13px' }}
              />
              <input
                className="form-input"
                value={substance.keterangan || ''}
                onChange={(event) => updateSubstance(index, 'keterangan', event.target.value)}
                placeholder="Keterangan"
                disabled={disabled}
                style={{ fontSize: '13px' }}
              />
              <button
                type="button"
                onClick={() => removeSubstance(index)}
                disabled={disabled}
                title="Hapus zat"
                style={{
                  width: '36px',
                  height: '36px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  border: '1px solid rgba(239,68,68,0.35)',
                  background: 'rgba(239,68,68,0.12)',
                  color: '#f87171',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={addSubstance}
        disabled={disabled}
        style={{
          marginTop: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(20,184,166,0.35)',
          background: 'rgba(20,184,166,0.12)',
          color: '#5eead4',
          fontSize: '13px',
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Plus size={15} />
        Tambah Zat
      </button>
    </div>
  );
}
