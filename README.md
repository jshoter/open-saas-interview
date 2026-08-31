# <YOUR_APP_NAME>

Built with [Wasp](https://wasp.sh), based on the [Open SaaS](https://github.com/wasp-lang/open-saas) project.

## Development

### Running locally

- Make sure you have the `.env.client` and `.env.server` files in the root of the project (see the `.env.example` files).
- Run the database with `wasp start db` and leave it running.
- Run `wasp start` and leave it running.
- [OPTIONAL]: If this is the first time starting the app, go to [http://localhost:3000](http://localhost:3000) and create a new user account.

### Generating Prisma Client

If you make changes to the `schema.prisma` file, run `wasp db migrate-dev` to apply the changes to the database and generate a new Prisma Client.

### Adding a new entity

To add a new entity, first update the `schema.prisma` file, then run `wasp db migrate-dev` to apply the changes to the database and generate a new Prisma Client. Then, create a new file in `src/features/<entity-name>/<entity-name>.wasp.ts` and follow the pattern from the existing entities. Finally, import the new entity in `main.wasp.ts`.

### Adding a new route

To add a new route, create a new file in `src/features/<route-name>/<route-name>.wasp.ts` and follow the pattern from the existing routes. Then, import the new route in `main.wasp.ts`.

### Adding a new page

To add a new page, create a new file in `src/features/<page-name>/<page-name>.jsx` and follow the pattern from the existing pages. Then, import the new page in the route file.

## Learn more

Learn more about the Wasp syntax [here](https://wasp.sh/docs/the-wasp-language/overview).

See the [Wasp Docs](https://wasp.sh/docs) to learn how to deploy your app, configure authentication, add email support and more.

Check out [the Open SaaS website](https://opensaas.sh) for more examples and resources.
