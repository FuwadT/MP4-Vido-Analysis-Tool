param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "us-central1",

    [string]$ServiceName = "waymo-dataset-studio",

    [Parameter(Mandatory = $true)]
    [string]$StorageBucket,

    [string]$ManifestPrefix = "cloud-manifests",

    [string]$UploadPrefix = "waymo-segments"
)

$image = "gcr.io/$ProjectId/$ServiceName"

Write-Host "Building container image $image"
gcloud config set project $ProjectId | Out-Null
gcloud builds submit --config cloudbuild.yaml --substitutions "_IMAGE=$image" .

Write-Host "Deploying Cloud Run service $ServiceName"
gcloud run deploy $ServiceName `
    --image $image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars "WAYMO_STORAGE_BUCKET=$StorageBucket,WAYMO_MANIFEST_PREFIX=$ManifestPrefix,WAYMO_UPLOAD_PREFIX=$UploadPrefix"
