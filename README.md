# Team information

| Team Members        | Github Id            | NUID      |
| ------------------- |:--------------------:|:---------:|
| Suhas Pasricha      | suhas1602            | 001434745 |
| Puneet Tanwar       | puneetneu            | 001409671 |
| Cyril Sebastian     | cyrilsebastian1811   | 001448384 |
| Shubham Sharma      | shubh1646            | 001447366 | 

# webapp-backend
This is the backend for the web application developed for CSYE 7374 course. We have used node.js and express.js to create REST API endpoints for a recipe management system. We are using PostgresQL for the database.

In order to run the application, navigate to the webapp folder and run "node index.js".

If running the application locally, create a .env file at the root of the project with the following variables

ENVIRONMENT = development

WEBAPP_PORT =<br />
DB_USER =<br />
DB_HOST_NAME =<br />
DB_DATABASE_NAME =<br />
DB_PASSWORD =<br />
DB_PORT =<br />

S3_BUCKET =<br />
AWS_ACCESS_KEY_ID =<br />
AWS_SECRET_ACCESS_KEY =<br />

REDIS_HOST = 127.0.0.1
REDIS_PORT = 6379
REDIS_PASSWORD =<br />

SENTINEL_PORT = 26379

# Docker hub and jenkins setup
1. Create a private repository in dockerhub for webapp-backend images
2. In Jenkins create 2 global credentials for dockerhub and github. The github password is a personal token created for jenkins.
3. Add a webhook to the repository in github for the url 'https://<jenkins.domain_name>/github-webhook/' with scope as 'repo' 
4. Create a new pipeline project in jenkins with the following settings-
    a. Github project - <Project url>
    b. Check option 'This project is parameterized'. Add the string parameters 'giturl' and 'registry' with values of git repository and dockerhub repository. Add a credentials parameter and pass the value of dockerhub credentials.
    c. Check 'GitHub hook trigger for GITScm polling' in 'Build Triggers'
    d. In 'Pipeline' choose Git and pass in the repository and credentials. 
5. You can also manually build the project with parameters.



### Jenkns Plugins to be Installed
1. GitHub Integration
2. Kubernetes CLI
3. SSH Agent

### Jenkins Configuration for Pipeline
#### Credentials
```
1. dockerhub_credentials(Username and Password) --> Username: cyrilsebastian1811, Password: Onepiece181195
2. github-ssh(SSH) --> Username: github, Private Key(contents of github private key file from local machine)
3. kubernetes_credentials(Username and Password) --> Username: admin, Password: (~/.kube/config/users:password | base64 )
```

#### Configure System
```
1. Manage Jenkins -> Configure System -> Cloud -> Kubernetes: Kubernetes server certificate key: (~/.kube/config/clusters:certificate-authority-data | base64decode ) Credentials: kubernetes_credentials
```