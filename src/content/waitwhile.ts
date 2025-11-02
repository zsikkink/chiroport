export type IntakeCategory = 'standard' | 'offers_massage';

export interface ServiceConfig {
  memberWithSpinal: string;
  memberWithoutSpinal: string;
  treatments: { [treatmentTitle: string]: string };
}

export const waitwhileServiceConfig: ServiceConfig = {
  memberWithSpinal: 'DoCvBDfuyv3HjlCra5Jc',
  memberWithoutSpinal: 'mZChb5bacT7AeVU7E3Rz',
  treatments: {
    'Body on the Go': 'IhqDpECD89j2e7pmHCEW',
    'Total Wellness': '11AxkuHmsd0tClHLitZ7',
    'Sciatica & Lower Back Targeted Therapy': 'QhSWYhwLpnoEFHJZkGQf',
    'Neck & Upper Back Targeted Therapy': '59q5NJG9miDfAgdtn8nK',
    'Trigger Point Muscle Therapy & Stretch': 'hD5KfCW1maA1Vx0za0fv',
    'Chiro Massage': 'ts1phHc92ktj04d0Gpve',
    'Chiro Massage Mini': 'J8qHXtrsRC2aNPA04YDc',
    'Undecided': 'FtfCqXMwnkqdft5aL0ZX',
    '15 Minutes': 'cyIjtFCpILcnJAD7c3Mo',
    '20 Minutes': 'KCoFYD7S99YjNaCjzFxV',
    '30 Minutes': 'ZBy2A2vgIAGUksm12RSQ',
  },
};

export const intakeCategoryByLocationId: Record<string, IntakeCategory> = {
  TyHFt6NehcmCK7gCAHod: 'offers_massage', // MSP Concourse C
  xutzfkaetOGtbokSpnW1: 'offers_massage', // MSP Concourse F
  kjAmNhyUygMlvVUje1gc: 'offers_massage', // LAS Concourse B
};
