import { AbstractStartedContainer, GenericContainer, StartedTestContainer } from "testcontainers";

const MSSQL_PORT = 1433;

type ProductKey = `${string}-${string}-${string}-${string}-${string}`;

type Edition = "Evaluation" | "Developer" | "Express" | "Web" | "Standard" | "Enterprise" | ProductKey;

const PASSWORD_CATEGORY_VALIDATION_PATTERNS = [/[A-Z]+/, /[a-z]+/, /[0-9]+/, /[@$!%*?&]+/];

export class MSSQLServerContainer extends GenericContainer {
  private database = "master";
  private username = "SA";
  private password = "Passw0rd";
  private edition: Edition = "Developer";
  private acceptEula = "N";

  constructor(image = "mcr.microsoft.com/mssql/server:2022-latest") {
    super(image);
  }

  public acceptLicense(): this {
    this.acceptEula = "Y";
    return this;
  }

  public withDatabase(database: string): this {
    this.database = database;
    return this;
  }

  public withPassword(password: string): this {
    this.checkPasswordStrength(password);
    this.password = password;
    return this;
  }

  public withEdition(edition: Edition): this {
    this.edition = edition;
    return this;
  }

  private checkPasswordStrength(password: string) {
    if (!password) {
      throw new Error("Null password is not allowed");
    }

    if (password.length < 8) {
      throw new Error("Password should be at least 8 characters long");
    }

    if (password.length > 128) {
      throw new Error("Password can be up to 128 characters long");
    }

    let satisfied = 0;

    for (const regex of PASSWORD_CATEGORY_VALIDATION_PATTERNS) {
      if (regex.test(password)) {
        satisfied++;
      }
    }

    if (satisfied < 3) {
      throw new Error(
        "Password must contain characters from three of the following four categories:\n" +
          " - Latin uppercase letters (A through Z)\n" +
          " - Latin lowercase letters (a through z)\n" +
          " - Base 10 digits (0 through 9)\n" +
          " - Non-alphanumeric characters such as: exclamation point (!), dollar sign ($), number sign (#), " +
          "or percent (%)."
      );
    }
  }

  public override async start(): Promise<StartedMSSQLServerContainer> {
    this.withExposedPorts(...(this.hasExposedPorts ? this.exposedPorts : [MSSQL_PORT]))
      .withEnvironment({
        ACCEPT_EULA: this.acceptEula,
        MSSQL_SA_PASSWORD: this.password,
        MSSQL_PID: this.edition,
        MSSQL_TCP_PORT: String(MSSQL_PORT),
      })
      .withStartupTimeout(120_000);

    return new StartedMSSQLServerContainer(await super.start(), this.database, this.username, this.password);
  }
}

export class StartedMSSQLServerContainer extends AbstractStartedContainer {
  constructor(
    startedTestContainer: StartedTestContainer,
    private readonly database: string,
    private readonly username: string,
    private readonly password: string
  ) {
    super(startedTestContainer);
  }

  public getPort(): number {
    return this.getMappedPort(MSSQL_PORT);
  }

  public getDatabase(): string {
    return this.database;
  }

  public getUsername(): string {
    return this.username;
  }

  public getPassword(): string {
    return this.password;
  }

  /**
   * @param {boolean} secure use secure connection?
   * @returns A connection URI in the form of `Server=<host>,1433;Database=<database>;User Id=<username>;Password=<password>;Encrypt=false`
   */
  public getConnectionUri(secure = false): string {
    return `Server=${this.getHost()},${this.getPort()};Database=${this.getDatabase()};User Id=${this.getUsername()};Password=${this.getPassword()};Encrypt=${secure}`;
  }
}