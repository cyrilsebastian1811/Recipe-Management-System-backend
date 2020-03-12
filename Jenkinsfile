// pipeline {
//   environment {
//     GIT_URL = "${env.GIT_URL}"
//     GIT_BRANCH = "${env.GIT_BRANCH}"
//     DOCKERHUB_CREDENTIALS = credentials('dockerhub_credentials')
//     GIT_CREDENTIALS = credentials('GitToken')
//     HELM_CHART_GIT_URL = "${env.HELM_CHART_GIT_URL}"
//     HELM_CHART_GIT_BRANCH = "${env.HELM_CHART_GIT_BRANCH}"
//     REPOSITORY_NAME = "${env.REPOSITORY_NAME}"
//     image_name = null
//     git_hash = null
//     image = null
//     git_message = null
//     scope = null
//   }
//   agent any
//   options {
//     skipDefaultCheckout(true)
//   }
  
//   stages {
//     stage('Cloning WEBAPP-BACKEND') {
//       steps {
//         script {
//           echo "${GIT_BRANCH}"
//           echo "${GIT_URL}"
//           sh("git config user.name")

//           git_info = git branch: "${GIT_BRANCH}", credentialsId: "GitToken", url: "${GIT_URL}"
//           git_hash = "${git_info.GIT_COMMIT[0..6]}"
//           git_message = sh(returnStdout: true, script: "git log --format=%B -n 1 ${git_info.GIT_COMMIT}")
//           image_name = "${DOCKERHUB_CREDENTIALS_USR}/${REPOSITORY_NAME}"

//           echo "${git_hash}"
//           echo "${image_name}"
          
//           echo "${git_message}"
//           scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*major.*) && echo \"major\" || echo \"minor\"")
//           scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*minor.*) && echo \"minor\" || echo \"${scope}\"")
//           scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*patch.*) && echo \"patch\" || echo \"${scope}\"")
//           scope = scope.replaceAll("[\n\r]", "")
//         }
//       }
//     }

//     stage('Build Image') { 
//       steps {
//         script {
//           image = docker.build("${image_name}")
//         }
//       }
//     }

//     stage('Push Image') { 
//       steps {
//         script {
//           def docker_info = docker.withRegistry("https://registry.hub.docker.com/", "dockerhub_credentials") {
//             image.push("${git_hash}")
//           }
//         }
//       }
//     }

//     stage('Remove Images') { 
//       steps {
//         sh "docker system prune --all -f"
//       }
//     }

//     stage('Checkout Helm-Charts') { 
//       steps {
//         script {
//           git_info = git branch: "${HELM_CHART_GIT_BRANCH}", credentialsId: 'GitToken', url: "${HELM_CHART_GIT_URL}"
//         }
//       }
//     }

//     stage('Helm-Charts update') { 
//       steps {
//         script{
//           sh "ls"
//           sh "pwd"
//           echo "${BUILD_NUMBER}"
//           sh "git checkout ${HELM_CHART_GIT_BRANCH}"
//           sh "git branch"

//           def presentVersion = sh(returnStdout: true, script: "yq r webapp-backend/Chart.yaml version")
//           echo "presentVersion: ${presentVersion}"
//           def (major, minor, patch) = presentVersion.tokenize('.').collect { it.toInteger() }
//           echo "major: $major, minor: $minor, patch: $patch"
//           def nextVersion = null
//           switch ("$scope") {
//             case "major":
//                 nextVersion = "${major + 1}.${minor}.${patch}"
//                 break
//             case "minor":
//                 nextVersion = "${major}.${minor + 1}.${patch}"
//                 break
//             case "patch":
//                 nextVersion = "${major}.${minor}.${patch + 1}"
//           }

//           sh "yq w -i webapp-backend/Chart.yaml 'version' ${nextVersion}"
//           sh "yq r webapp-backend/Chart.yaml version"
//           sh "yq w -i webapp-backend/values.yaml 'dockerImage' ${image_name}:${git_hash}"
//           sh "yq w -i webapp-backend/values.yaml 'imageCredentials.registry' https://index.docker.io/v1/"

//           withCredentials([usernamePassword(credentialsId: 'GitToken', usernameVariable: "${GIT_CREDENTIALS_USR}", passwordVariable: "${GIT_CREDENTIALS_PSW}")]){
//             sh("git config user.name")
//             sh "git commit -am 'version upgrade to ${nextVersion} by jenkins'"
//             sh("git push origin ${HELM_CHART_GIT_BRANCH}")
//           }
//         }
//       }
//     }
//   }
// }

node {

  environment {
    GIT_URL = "${env.GIT_URL}"
    GIT_BRANCH = "${env.GIT_BRANCH}"
    DOCKERHUB_CREDENTIALS = credentials('dockerhub_credentials')
    GIT_CREDENTIALS = credentials('GitToken')
    HELM_CHART_GIT_URL = "${env.HELM_CHART_GIT_URL}"
    HELM_CHART_GIT_BRANCH = "${env.HELM_CHART_GIT_BRANCH}"
    REPOSITORY_NAME = "${env.REPOSITORY_NAME}"
    image_name = null
    git_hash = null
    image = null
    git_message = null
    scope = null
  }

  stage('Cloning WEBAPP-BACKEND') {
    script {
      echo "${GIT_BRANCH}"
      echo "${GIT_URL}"
      sh("git config user.name")

      git_info = git branch: "${GIT_BRANCH}", credentialsId: "GitToken", url: "${GIT_URL}"
      git_hash = "${git_info.GIT_COMMIT[0..6]}"
      git_message = sh(returnStdout: true, script: "git log --format=%B -n 1 ${git_info.GIT_COMMIT}")
      echo "$DOCKERHUB_CREDENTIALS"
      image_name = "${DOCKERHUB_CREDENTIALS_USR}/${REPOSITORY_NAME}"

      echo "${git_hash}"
      echo "${image_name}"
      
      echo "${git_message}"
      scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*major.*) && echo \"major\" || echo \"minor\"")
      scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*minor.*) && echo \"minor\" || echo \"${scope}\"")
      scope = sh(returnStdout: true, script: "(echo \"$git_message\" | grep -Eq  ^.*patch.*) && echo \"patch\" || echo \"${scope}\"")
      scope = scope.replaceAll("[\n\r]", "")
    }
  }

  stage('Build Image') { 
    script {
      image = docker.build("${image_name}")
    }
  }

  stage('Push Image') { 
    script {
      def docker_info = docker.withRegistry("https://registry.hub.docker.com/", "dockerhub_credentials") {
        image.push("${git_hash}")
      }
    }
  }

  stage('Remove Images') { 
    sh "docker system prune --all -f"
  }

  stage('Checkout Helm-Charts') { 
    script {
      git_info = git branch: "${HELM_CHART_GIT_BRANCH}", credentialsId: 'GitToken', url: "${HELM_CHART_GIT_URL}"
    }
  }

  stage('Helm-Charts update') { 
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
      def nextVersion = null
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
      sh "yq w -i webapp-backend/values.yaml 'dockerImage' ${image_name}:${git_hash}"
      sh "yq w -i webapp-backend/values.yaml 'imageCredentials.registry' https://index.docker.io/v1/"
      sh("git config user.name")

      withCredentials([usernamePassword(credentialsId: 'GitToken', usernameVariable: "${GIT_CREDENTIALS_USR}", passwordVariable: "${GIT_CREDENTIALS_PSW}")]){
        sh "git commit -am 'version upgrade to ${nextVersion} by jenkins'"
        sh("git push origin ${HELM_CHART_GIT_BRANCH}")
      }
    }
  }

}