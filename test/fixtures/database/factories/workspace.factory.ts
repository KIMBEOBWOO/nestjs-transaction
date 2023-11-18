import { setSeederFactory } from 'typeorm-extension';
import { Workspace } from '../entities';

export default setSeederFactory(Workspace, (faker) => {
  const workspace = new Workspace();
  workspace.name = faker.company.name().slice(0, 30);

  return workspace;
});
