pipeline {
    agent any

    environment {
        DOCKER_REPO             = "chaitanyaaaa/ecommerce-microservices"
        DOCKER_BUILDKIT         = "0"
        BUILDX_NO_DEFAULT_ATTESTATIONS = "1"
        API_GATEWAY_IMAGE       = "${DOCKER_REPO}-api-gateway"
        USER_SERVICE_IMAGE      = "${DOCKER_REPO}-user-service"
        CART_SERVICE_IMAGE      = "${DOCKER_REPO}-cart-service"
        ORDER_SERVICE_IMAGE     = "${DOCKER_REPO}-order-service"
        PRODUCT_SERVICE_IMAGE   = "${DOCKER_REPO}-product-service"
        PAYMENT_SERVICE_IMAGE   = "${DOCKER_REPO}-payment-service"
        TAG                     = "1.${BUILD_NUMBER}"
        HELM_RELEASE            = "ecommerce"
        HELM_CHART              = "./helm/ecommerce"
        MICROSERVICES_NAMESPACE = "ecommerce"
        MONITORING_NAMESPACE    = "monitoring"
        MONITORING_RELEASE      = "monitoring"
    }

    stages {

        stage("TEST") {
            steps {
                sh "echo 'run unit tests here will do later'"
            }
        }

        // Sequential builds — slow PC friendly :)
        // Will update with parallel blocks later
        stage("BUILD") {
            steps {
                dir("user-service") {
                    sh "docker build -t ${USER_SERVICE_IMAGE}:${TAG} ."
                }
                dir("cart-service") {
                    sh "docker build -t ${CART_SERVICE_IMAGE}:${TAG} ."
                }
                dir("order-service") {
                    sh "docker build -t ${ORDER_SERVICE_IMAGE}:${TAG} ."
                }
                dir("product-service") {
                    sh "docker build -t ${PRODUCT_SERVICE_IMAGE}:${TAG} ."
                }
                dir("payment-service") {
                    sh "docker build -t ${PAYMENT_SERVICE_IMAGE}:${TAG} ."
                }
                dir("api-gateway") {
                    sh "docker build -t ${API_GATEWAY_IMAGE}:${TAG} ."
                }
            }
        }

        stage("PUSH") {
            steps {
                withCredentials([usernamePassword(credentialsId: "DockerHub-Creds",
                usernameVariable: "USER", passwordVariable: "PASS")]) {
                    sh """
                        echo $PASS | docker login -u \$USER --password-stdin
                        docker push ${USER_SERVICE_IMAGE}:${TAG}
                        docker push ${CART_SERVICE_IMAGE}:${TAG}
                        docker push ${ORDER_SERVICE_IMAGE}:${TAG}
                        docker push ${PRODUCT_SERVICE_IMAGE}:${TAG}
                        docker push ${PAYMENT_SERVICE_IMAGE}:${TAG}
                        docker push ${API_GATEWAY_IMAGE}:${TAG}
                    """
                }
            }
        }

        stage("DEPLOY") {
            steps {
                withCredentials([file(credentialsId: "kubeconfig", variable: "KUBECONFIG")]) {
                    sh """
                        export KUBECONFIG=$KUBECONFIG
                        helm upgrade --install ${HELM_RELEASE} ${HELM_CHART} \
                            --namespace ${MICROSERVICES_NAMESPACE} --create-namespace \
                            --set apiGateway.image.tag=${TAG} \
                            --set userService.image.tag=${TAG} \
                            --set productService.image.tag=${TAG} \
                            --set cartService.image.tag=${TAG} \
                            --set orderService.image.tag=${TAG} \
                            --set paymentService.image.tag=${TAG}
                    """
                }
            }
        }

        stage("MONITORING_STACK_DEPLOY") {
            steps {
                withCredentials([file(credentialsId: "kubeconfig", variable: "KUBECONFIG")]) {
                    sh """
                        export KUBECONFIG=$KUBECONFIG
                        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts || true
                        helm repo update

                        kubectl create namespace ${MONITORING_NAMESPACE} || true
                        helm upgrade --install ${MONITORING_RELEASE} prometheus-community/kube-prometheus-stack \
                        --namespace ${MONITORING_NAMESPACE} \
                        --set grafana.adminPassword=admin123 \
                        --set prometheus.prometheusSpec.retention=7d 
                        """
                }
            }
        }

        stage("VERIFY DEPLOYMENT") {
            steps {
                withCredentials([file(credentialsId: "kubeconfig", variable: "KUBECONFIG")]) {
                    sh """
                        export KUBECONFIG=$KUBECONFIG
                        kubectl get all -n ${MICROSERVICES_NAMESPACE}
                        kubectl get all -n ${MONITORING_NAMESPACE}
                    """
                }
            }
        }

    }
}
