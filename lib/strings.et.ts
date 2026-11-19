// All Estonian text the user sees, in one place so it is easy to review with the client.
// Sections are owned by the area that uses them: the frontend adds the UI sections here.

/** Text in the exported .xlsx file (Backend area). */
export const xlsx = {
  headers: {
    no: 'Nr',
    date: 'Kuupäev',
    description: 'Kirjeldus',
    quantity: 'Kogus',
    unit: 'Ühik',
    unitPrice: 'Ühiku hind',
    total: 'Summa',
  },
  totals: {
    subtotal: 'Vahesumma',
    taxRate: 'Käibemaksumäär',
    tax: 'Käibemaks',
    total: 'Kokku koos käibemaksuga',
  },
  percentUnit: 'ülalolevatest',
  defaultSheetName: 'Projekt',
} as const;

/** Text in the app UI (Frontend area). */
export const ui = {
  appName: 'Lihtne Excel',
  appDescription: 'Koosta projekti eelarve ja laadi see alla Exceli failina.',
  projects: {
    title: 'Projektid',
    empty: 'Sul pole veel ühtegi projekti.',
  },
  project: {
    demoTitle: 'Näidisprojekt',
    downloadExcel: 'Laadi alla Excel',
  },
  table: {
    columns: {
      no: 'Nr',
      description: 'Kirjeldus',
      calcType: 'Arvutus',
      quantity: 'Kogus',
      unit: 'Ühik',
      unitPrice: 'Ühiku hind',
      percent: 'Protsent',
      total: 'Summa',
      actions: 'Toimingud',
    },
    calcTypes: {
      fixed: 'Kindel summa',
      qty_price: 'Kogus × hind',
      percent: '% ülalolevatest ridadest',
    },
    percentSuffix: '% ülalolevatest',
    descriptionPlaceholder: 'nt Seinte värvimine',
    unitPlaceholder: 'm², h, tk',
    rowLabel: (no: number) => `rida ${no}`,
    empty: 'Tabelis pole veel ridu. Alusta nupuga „Lisa rida“.',
    addRow: 'Lisa rida',
    moveUp: 'Liiguta üles',
    moveDown: 'Liiguta alla',
    moreActions: 'Rohkem valikuid',
    duplicate: 'Tee koopia',
    delete: 'Kustuta',
    invalidNumber: (decimals: number) => `Sisesta number, kuni ${decimals} kohta pärast koma (nt 12,50)`,
    negativeSubtotal: 'Vahesumma on alla nulli. Kontrolli allahindlusi.',
    totals: xlsx.totals,
  },
} as const;
