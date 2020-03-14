pipeline {
  environment {
    // Credentials Parameters
    DOCKERHUB_CREDENTIALS = credentials('dockerhub_credentials')
    DB_CREDENTIALS = credentials('db_credentials')
    // DOCKERHUB_CREDENTIALS = "${env.dockerhub_credentials}"
    // DB_CREDENTIALS = "${env.db_credentials}"

    // // String Parameters
    GIT_URL = "${env.GIT_URL}"
    GIT_BRANCH = "${env.GIT_BRANCH}"
    HELM_CHART_GIT_URL = "${env.HELM_CHART_GIT_URL}"
    HELM_CHART_GIT_BRANCH = "${env.HELM_CHART_GIT_BRANCH}"
    REPOSITORY = "${env.REPOSITORY}"
    S3_BUCKET_URL = "${env.S3_BUCKET_URL}"
    RDS_ENDPOINT = "${env.RDS_ENDPOINT}"
    KUBERNETES_API = "${env.KUBERNETES_API}"

    // // Password Parameters
    AWS_ACCESS_KEY_ID = "${env.AWS_ACCESS_KEY_ID}"
    AWS_SECRET_ACCESS_KEY = "${env.AWS_SECRET_ACCESS_KEY}"
    REDIS_PSW = "${env.REDIS_PSW}"
    
    // // Default Parameters
    image_name = null
    git_hash = null
    image = null
    git_message = null
    scope = null
    nextVersion = null
  }
  agent any
  options {
    skipDefaultCheckout(true)
  }
  
  stages {
    stage('Cloning WEBAPP-BACKEND') {
      steps {
        script {
          echo "${GIT_BRANCH}"
          echo "${GIT_URL}"
          sh("git config user.name")
          echo "${DOCKERHUB_CREDENTIALS}"
          echo "${DB_CREDENTIALS}"

          git_info = git branch: "${GIT_BRANCH}", credentialsId: "github-ssh", url: "${GIT_URL}"
          git_hash = "${git_info.GIT_COMMIT[0..6]}"
          git_message = sh(returnStdout: true, script: "git log --format=%B -n 1 ${git_info.GIT_COMMIT}")
          // image_name = "${DOCKERHUB_CREDENTIALS_USR}/${REPOSITORY_NAME}"

          echo "${git_hash}"
          // echo "${image_name}"
          
          echo "${git_message}"
          scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*major.*) && echo \"major\" || echo \"minor\"")
          scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*minor.*) && echo \"minor\" || echo \"${scope}\"")
          scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*patch.*) && echo \"patch\" || echo \"${scope}\"")
          scope = scope.replaceAll("[\n\r]", "")
        }
      }
    }

    stage('Build Image') { 
      steps {
        script {
          image = docker.build("${REPOSITORY}")
        }
      }
    }

    stage('Push Image') { 
      steps {
        script {
          def docker_info = docker.withRegistry("https://registry.hub.docker.com/", 'dockerhub_credentials') {
            image.push("${git_hash}")
          }
        }
      }
    }

    stage('Remove Images') { 
      steps {
        sh "docker system prune --all -f"
      }
    }

    stage('Checkout Helm-Charts') { 
      steps {
        script {
          git_info = git branch: "${HELM_CHART_GIT_BRANCH}", credentialsId: 'github-ssh', url: "${HELM_CHART_GIT_URL}"
        }
      }
    }

    stage('Helm-Charts update') {
      steps {
        script{
          sh "ls"
          sh "pwd"
          echo "${BUILD_NUMBER}"
          sh "git checkout ${HELM_CHART_GIT_BRANCH}"
          sh "git branch"

          def presentVersion = sh(returnStdout: true, script: "yq r webapp-backend/Chart.yaml version")
          echo "presentVersion: ${presentVersion}"
          def (major, minor, patch) = presentVersion.tokenize('.').collect { it.toInteger() }
          echo "major: $major, minor: $minor, patch: $patch"
          switch ("$scope") {
            case "major":
                nextVersion = "${major + 1}.${minor}.${patch}"
                break
            case "minor":
                nextVersion = "${major}.${minor + 1}.${patch}"
                break
            case "patch":
                nextVersion = "${major}.${minor}.${patch + 1}"
          }

          sh "yq w -i webapp-backend/Chart.yaml 'version' ${nextVersion}"
          sh "yq r webapp-backend/Chart.yaml version"
          sh "yq w -i webapp-backend/values.yaml 'dockerImage' ${REPOSITORY}:${git_hash}"
          sh "yq w -i webapp-backend/values.yaml 'imageCredentials.registry' https://index.docker.io/v1/"

        }
      }
    }

    stage('bakend helm chart install') {
      steps {
        script {
          sh "pwd"
          sh "ls -a"
          withKubeConfig([credentialsId: 'kubernetes_credentials', serverUrl: "${KUBERNETES_API}"]) {
            sh "kubectl get ns"
            sh "helm version"
            sh "helm dependency update ./webapp-backend"
            sh("helm upgrade backend ./webapp-backend -n api --install --wait --set dbUser=${DB_CREDENTIALS_USR},dbPassword=${DB_CREDENTIALS_PSW},imageCredentials.username=${DOCKERHUB_CREDENTIALS_USR},imageCredentials.password=${DOCKERHUB_CREDENTIALS_PSW},rdsEndpoint=${RDS_ENDPOINT},s3Bucket=${S3_BUCKET_URL},awsAccess=${AWS_ACCESS_KEY_ID},awsSecret=${AWS_SECRET_ACCESS_KEY},redis.global.redis.password=${REDIS_PSW},imageCredentials.registry=https://index.docker.io/v1/")
          }
        }
      }
    }

    stage('Push to Helm-Charts Repo') {
      steps {
        script {
          sshagent(['github-ssh']) {
            sh("git config user.name")
            sh "git commit -am 'version upgrade to ${nextVersion} by jenkins'"
            sh("git push origin ${HELM_CHART_GIT_BRANCH}")
          }
        }
      }
    }
  }
}