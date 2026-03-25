export type PublicRegistrationChoice = {
  value: string;
  label: string;
};

export type PublicRegistrationChildInput = {
  full_name: string;
  diet: string | null;
  observations: string;
};

export type PublicRegistrationFormValues = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  heard_about: string;
  role: string | null;
  diet: string | null;
  observations: string;
  children: PublicRegistrationChildInput[];
};

export type PublicRegistrationMeta = {
  role: PublicRegistrationChoice[];
  diet: PublicRegistrationChoice[];
};

export type PublicRegistrationPayload = {
  full_name: string;
  phone?: string;
  email?: string;
  address: string;
  heard_about: string;
  role: string;
  diet: string;
  observations: string;
  children: Array<{
    full_name: string;
    diet: string;
    observations: string;
  }>;
};

export type PublicRegistrationSubmitResponse = {
  detail: string;
};
