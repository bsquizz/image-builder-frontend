import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { CREATE_BLUEPRINT, EDIT_BLUEPRINT } from '../../../../../constants';
import { CreateBlueprintRequest } from '../../../../../store/imageBuilderApi';
import { mockBlueprintIds } from '../../../../fixtures/blueprints';
import {
  baseCreateBlueprintRequest,
  expectedFilesystemCisL2,
  expectedKernelCisL2,
  expectedOpenscapCisL2,
  expectedPackagesCisL2,
  expectedServicesCisL2,
  oscapCreateBlueprintRequest,
} from '../../../../fixtures/editMode';
import { clickNext } from '../../../../testUtils';
import {
  clickRegisterLater,
  enterBlueprintName,
  interceptBlueprintRequest,
  interceptEditBlueprintRequest,
  openAndDismissSaveAndBuildModal,
  renderCreateMode,
  renderEditMode,
} from '../../wizardTestUtils';

vi.mock('@redhat-cloud-services/frontend-components/useChrome', () => ({
  useChrome: () => ({
    auth: {
      getUser: () => {
        return {
          identity: {
            internal: {
              org_id: 5,
            },
          },
        };
      },
    },
    isBeta: () => true,
    isProd: () => true,
    getEnvironment: () => 'prod',
  }),
}));

vi.mock('@unleash/proxy-client-react', () => ({
  useUnleashContext: () => vi.fn(),
  useFlag: vi.fn((flag) => {
    switch (flag) {
      case 'image-builder.firstboot.enabled':
        return true;
      case 'image-builder.snapshots.enabled':
        return true;
      default:
        return false;
    }
  }),
}));

const goToOscapStep = async () => {
  const user = userEvent.setup();
  const guestImageCheckBox = await screen.findByRole('checkbox', {
    name: /virtualization guest image checkbox/i,
  });
  await waitFor(() => user.click(guestImageCheckBox));
  await clickNext(); // Registration
  await clickRegisterLater();
  await clickNext(); // OpenSCAP
};

const selectProfile = async () => {
  const user = userEvent.setup();
  const selectProfileDropdown = await screen.findByRole('textbox', {
    name: /select a profile/i,
  });
  await waitFor(() => user.click(selectProfileDropdown));

  const cis1Profile = await screen.findByText(
    /cis red hat enterprise linux 8 benchmark for level 1 - workstation/i
  );
  await waitFor(() => user.click(cis1Profile));
};

const selectDifferentProfile = async () => {
  const user = userEvent.setup();
  const selectProfileDropdown = await screen.findByRole('textbox', {
    name: /select a profile/i,
  });
  await waitFor(() => user.click(selectProfileDropdown));

  const cis2Profile = await screen.findByText(
    /cis red hat enterprise linux 8 benchmark for level 2 - workstation/i
  );
  await waitFor(() => user.click(cis2Profile));
};

const selectNone = async () => {
  const user = userEvent.setup();
  const selectProfileDropdown = await screen.findByRole('textbox', {
    name: /select a profile/i,
  });
  await waitFor(() => user.click(selectProfileDropdown));

  await waitFor(async () => user.click(await screen.findByText(/none/i)));
};

const goToReviewStep = async () => {
  await clickNext(); // File system configuration
  await clickNext(); // Snapshot repositories
  await clickNext(); // Custom repositories
  await clickNext(); // Additional packages
  await clickNext(); // FirstBoot
  await clickNext(); // Details
  await enterBlueprintName('Oscap test');
  await clickNext(); // Review
};

describe('oscap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('add a profile', async () => {
    await renderCreateMode();
    await goToOscapStep();
    await selectProfile();
    await goToReviewStep();
    // informational modal pops up in the first test only as it's tied
    // to a 'imageBuilder.saveAndBuildModalSeen' variable in localStorage
    await openAndDismissSaveAndBuildModal();

    const receivedRequest = await interceptBlueprintRequest(CREATE_BLUEPRINT);

    const expectedRequest: CreateBlueprintRequest = {
      ...oscapCreateBlueprintRequest,
      name: 'Oscap test',
    };
    await waitFor(() => {
      expect(receivedRequest).toEqual(expectedRequest);
    });
  });

  test('remove a profile', { retry: 3, timeout: 20000 }, async () => {
    await renderCreateMode();
    await goToOscapStep();
    await selectProfile();
    await selectNone();
    await goToReviewStep();

    const receivedRequest = await interceptBlueprintRequest(CREATE_BLUEPRINT);

    const expectedRequest: CreateBlueprintRequest = {
      ...baseCreateBlueprintRequest,
      name: 'Oscap test',
    };
    await waitFor(() => {
      expect(receivedRequest).toEqual(expectedRequest);
    });
  });

  test('change profile', { retry: 3, timeout: 20000 }, async () => {
    await renderCreateMode();
    await goToOscapStep();
    await selectProfile();
    await selectDifferentProfile();
    await goToReviewStep();

    const receivedRequest = await interceptBlueprintRequest(CREATE_BLUEPRINT);

    const expectedRequest: CreateBlueprintRequest = {
      ...baseCreateBlueprintRequest,
      customizations: {
        packages: expectedPackagesCisL2,
        openscap: expectedOpenscapCisL2,
        services: expectedServicesCisL2,
        kernel: expectedKernelCisL2,
        filesystem: expectedFilesystemCisL2,
      },
      name: 'Oscap test',
    };

    await waitFor(() => {
      expect(receivedRequest).toEqual(expectedRequest);
    });
  });
});

describe('OpenSCAP edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const user = userEvent.setup();
  test('edit mode works', async () => {
    const id = mockBlueprintIds['oscap'];
    await renderEditMode(id);

    // starts on review step
    const receivedRequest = await interceptEditBlueprintRequest(
      `${EDIT_BLUEPRINT}/${id}`
    );
    const expectedRequest = oscapCreateBlueprintRequest;
    expect(receivedRequest).toEqual(expectedRequest);
  });

  test('fsc and packages get populated on edit', async () => {
    const id = mockBlueprintIds['oscap'];
    await renderEditMode(id);

    // check that the FSC contains a /tmp partition
    const fscBtns = await screen.findAllByRole('button', {
      name: /file system configuration/i,
    });
    user.click(fscBtns[0]);
    await screen.findByRole('heading', { name: /file system configuration/i });
    await screen.findByText('/tmp');
    // check that the Packages contain neovim package
    const packagesNavBtn = await screen.findByRole('button', {
      name: /additional packages/i,
    });
    user.click(packagesNavBtn);
    await screen.findByRole('heading', {
      name: /Additional packages/i,
    });
    const selectedBtn = await screen.findByRole('button', {
      name: /Selected/i,
    });
    user.click(selectedBtn);
    await screen.findByText('neovim');
  });
});
