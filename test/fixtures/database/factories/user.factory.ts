import { setSeederFactory } from 'typeorm-extension';
import { User } from '../entities';

export default setSeederFactory(User, (faker) => {
  const user = new User();
  user.email = faker.internet.email({});

  return user;
});
