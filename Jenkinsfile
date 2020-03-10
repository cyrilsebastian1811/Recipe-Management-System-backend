pipeline {
  environment {
    GIT_URL = "${env.GIT_URL}"
    GIT_BRANCH = "${env.GIT_BRANCH}"
    DOCKERHUB_CREDENTIALS = credentials('dockerhub_credentials')
    HELM_CHART_GIT_URL = "${env.HELM_CHART_GIT_URL}"
    HELM_CHART_GIT_BRANCH = "${env.HELM_CHART_GIT_BRANCH}"
    REPOSITORY_NAME = "${env.REPOSITORY_NAME}"
    image_name = null
    git_hash = null
    image = null
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

          git_info = git branch: "${GIT_BRANCH}", credentialsId: "github-ssh", url: "${GIT_URL}"
          git_hash = "${git_info.GIT_COMMIT[0..6]}"
          image_name = "${DOCKERHUB_CREDENTIALS_USR}/${REPOSITORY_NAME}"

          echo "${git_hash}"
          echo "${image_name}"
        }
      }
    }

    stage('Build Image') { 
      steps {
        script {
          image = docker.build("${image_name}")
        }
      }
    }

    stage('Push Image') { 
      steps {
        script {
          def docker_info = docker.withRegistry("https://registry.hub.docker.com/", "dockerhub_credentials") {
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

    // stage('Helm-Charts update') { 
    //   steps {
    //     sh "ls"
    //     sh "pwd"
    //     echo "${BUILD_NUMBER}"
    //     sh "git checkout ${HELM_CHART_GIT_BRANCH}"
    //     sh "git branch"

    //     sh "yq r webapp-backend/Chart.yaml version"
    //     sh "yq w -i webapp-backend/Chart.yaml 'version' 0.1.${BUILD_NUMBER}"
    //     sh "yq r webapp-backend/Chart.yaml version"
    //     sh "yq w -i webapp-backend/values.yaml 'dockerImage' ${image_name}:${git_hash}"
    //     sh "yq w -i webapp-backend/values.yaml 'imageCredentials.registry' https://index.docker.io/v1/"
        
    //     sh "git commit -am 'version upgrade to 0.1.${BUILD_NUMBER} by jenkins'"
    //     sshagent (credentials: ['github-ssh']) {
    //         sh("git push origin ${HELM_CHART_GIT_BRANCH}")
    //     }
    //   }
    // }
  }
}