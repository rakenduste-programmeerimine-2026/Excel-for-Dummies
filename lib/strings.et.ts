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
} as const;
