export interface Recruiter {
  id: string;
  name: string;
  title: string;
  email: string;
  is_active?: boolean;
  created_at?: string;
}

export const DEFAULT_RECRUITERS: Recruiter[] = [
  {
    id: "f9e7cb92-8ee2-4936-8119-03272f096074",
    name: "Mike Pasaron",
    title: "Recruiter",
    email: "mepasaron@rfcservice.com",
    is_active: true,
  },
  {
    id: "96ae2fc4-9091-451f-80c1-ccce2a389bc8",
    name: "Marinel Marcelino",
    title: "Recruiter",
    email: "mmarcelino@rfcservice.com",
    is_active: true,
  },
  {
    id: "618b3d6f-ebd5-4007-bf4d-a6fbabfeaab2",
    name: "Joche Alfuente",
    title: "Recruiter",
    email: "jalfuente@rfcservice.com",
    is_active: true,
  },
  {
    id: "11ddc5db-ca0d-4912-8fd1-fa5f9ef66606",
    name: "Default Recruiter",
    title: "Recruiter",
    email: "recruiter@rfcservice.com",
    is_active: true,
  },
];
